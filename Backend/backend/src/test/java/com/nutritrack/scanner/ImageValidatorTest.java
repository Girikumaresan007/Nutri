package com.nutritrack.scanner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nutritrack.config.ScannerProperties;
import com.nutritrack.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

class ImageValidatorTest {
    private final ImageValidator validator = new ImageValidator(new ScannerProperties("mock", DataSize.ofKilobytes(1), null, null));

    private static byte[] pad(byte[] head, int total) {
        byte[] b = new byte[total];
        System.arraycopy(head, 0, b, 0, head.length);
        return b;
    }

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    private static ApiException thrown(Runnable r) {
        try { r.run(); } catch (ApiException e) { return e; }
        throw new AssertionError("expected ApiException");
    }

    @Test
    void acceptsRealJpegPngWebp() {
        assertThat(validator.validate(new MockMultipartFile("image", "a.jpg", "image/jpeg", pad(JPEG, 100))).mimeType()).isEqualTo("image/jpeg");
        assertThat(validator.validate(new MockMultipartFile("image", "a.png", "image/png", pad(PNG, 100))).mimeType()).isEqualTo("image/png");
        byte[] webp = pad(new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}, 100);
        assertThat(validator.validate(new MockMultipartFile("image", "a.webp", "image/webp", webp)).mimeType()).isEqualTo("image/webp");
    }

    @Test
    void rejectsDisguisedFile() {
        ApiException e = thrown(() -> validator.validate(new MockMultipartFile("image", "a.jpg", "image/jpeg", "hello world".getBytes())));
        assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsMismatchedSignature() {
        ApiException e = thrown(() -> validator.validate(new MockMultipartFile("image", "a.png", "image/png", pad(JPEG, 100))));
        assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsUnsupportedType() {
        ApiException e = thrown(() -> validator.validate(new MockMultipartFile("image", "a.pdf", "application/pdf", "%PDF".getBytes())));
        assertThat(e.status()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    @Test
    void rejectsEmptyAndOversized() {
        assertThat(thrown(() -> validator.validate(new MockMultipartFile("image", "a.jpg", "image/jpeg", new byte[0]))).status())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(thrown(() -> validator.validate(new MockMultipartFile("image", "a.jpg", "image/jpeg", pad(JPEG, 2048)))).status())
                .isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
    }
}
