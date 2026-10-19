package com.nutritrack.common;

import com.nutritrack.exception.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public final class PageParams {
    public static final int DEFAULT_SIZE = 100;
    public static final int MAX_SIZE = 500;

    private PageParams() {}

    public static Pageable of(int page, int size, Sort sort) {
        if (page < 0) {
            throw ApiException.validation("page", "page must be 0 or greater");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw ApiException.validation("size", "size must be between 1 and " + MAX_SIZE);
        }
        return PageRequest.of(page, size, sort);
    }
}
