package com.portfolio.risk.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.portfolio.risk.model.StockPrice;

@Repository
public interface StockPriceRepository extends JpaRepository<StockPrice, Long>{

    Optional<StockPrice> findTopBySymbolOrderByFetchedAtDesc(String symbol);

    List<StockPrice> findBySymbolAndFetchedAtAfterOrderByFetchedAtAsc(String symbol, LocalDateTime after);

    @Query("SELECT DISTINCT sp.symbol FROM StockPrice sp")
    List<String> findDistinctSymbols();

    @Query("SELECT sp FROM StockPrice sp WHERE sp.symbol = :symbol ORDER BY sp.fetchedAt DESC LIMIT :limit")
    List<StockPrice> findRecentPrices(@Param("symbol") String symbol, @Param("limit") int limit);
}
