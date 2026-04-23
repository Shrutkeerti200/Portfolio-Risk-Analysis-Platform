package com.portfolio.notification.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@ConditionalOnProperty(name = "messaging.mode", havingValue = "kafka", matchIfMissing = true)
@Import(KafkaAutoConfiguration.class)
public class KafkaConditionConfig {
    // Kafka auto-config only loads when messaging.mode=kafka
}