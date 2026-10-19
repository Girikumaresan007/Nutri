package com.nutritrack.scanner;

import com.nutritrack.config.ScannerProperties;
import com.nutritrack.exception.ApiException;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates declared type, size and the real file signature (magic bytes). Does not decode the image, so a file with
 * a valid header but corrupt body can still reach the provider, which will simply fail to analyse it.
 */
@Component
public class ImageValidator {
    static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");

    private final long maxBytes;

    public ImageValidator(ScannerProperties props) {
        this.maxBytes = props.maxFileSize().toBytes();
    }

    public ValidatedImage validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "An image file is required");
        }
        if (file.getSize() > maxBytes) {
            throw tooLarge();
        }
        String declared = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT).split(";")[0].trim();
        if (declared.equals("image/jpg")) declared = "image/jpeg";
        if (!ALLOWED.contains(declared)) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                    "Only JPEG, PNG and WebP images are supported");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();   // held in memory only
        } catch (IOException e) {
            throw ApiException.badRequest("INVALID_IMAGE", "The uploaded file could not be read");
        }
        if (bytes.length > maxBytes) {
            throw tooLarge();
        }
        String detected = detect(bytes);
        if (detected == null || !detected.equals(declared)) {
            throw ApiException.badRequest("INVALID_IMAGE", "The file content is not a valid image of the declared type");
        }
        return new ValidatedImage(bytes, detected);
    }

    static String detect(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        if (b.length >= 8 && startsWith(b, png)) {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private static boolean startsWith(byte[] b, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) if (b[i] != prefix[i]) return false;
        return true;
    }

    private static ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", "Image exceeds the maximum upload size");
    }
}
