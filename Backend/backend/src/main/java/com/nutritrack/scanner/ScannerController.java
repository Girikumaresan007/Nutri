package com.nutritrack.scanner;

import com.nutritrack.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/scanner")
@Tag(name = "AI food scanner")
public class ScannerController {
    private final ScannerService service;

    public ScannerController(ScannerService service) {
        this.service = service;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScanResponse analyze(@AuthenticationPrincipal AuthenticatedUser user,
                                @RequestParam("image") MultipartFile image,
                                @RequestParam(value = "description", required = false) String description) {
        return service.analyzeImage(user.id(), image, description);
    }

    @PostMapping("/text-estimate")
    public ScanResponse textEstimate(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody TextEstimateRequest request) {
        return service.estimateText(user.id(), request.description());
    }
}
