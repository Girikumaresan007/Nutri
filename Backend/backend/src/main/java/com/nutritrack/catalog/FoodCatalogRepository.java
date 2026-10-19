package com.nutritrack.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FoodCatalogRepository extends JpaRepository<FoodCatalogItem, UUID> {

    Optional<FoodCatalogItem> findByCode(String code);

    Optional<FoodCatalogItem> findByCanonicalNameIgnoreCase(String canonicalName);

    @Query("SELECT f FROM FoodCatalogItem f WHERE " +
           "(:query IS NULL OR :query = '' OR " +
           "LOWER(f.canonicalName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(f.regionalAliases) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "(:category IS NULL OR :category = '' OR f.category = :category) " +
           "ORDER BY f.canonicalName ASC")
    List<FoodCatalogItem> searchCatalog(@Param("query") String query,
                                        @Param("category") String category,
                                        Pageable pageable);

    @Query("SELECT f FROM FoodCatalogItem f WHERE " +
           "LOWER(:name) LIKE LOWER(CONCAT('%', f.canonicalName, '%')) OR " +
           "LOWER(f.canonicalName) LIKE LOWER(CONCAT('%', :name, '%')) OR " +
           "LOWER(f.regionalAliases) LIKE LOWER(CONCAT('%', :name, '%')) " +
           "ORDER BY LENGTH(f.canonicalName) ASC")
    List<FoodCatalogItem> findBestMatches(@Param("name") String name, Pageable pageable);
}
