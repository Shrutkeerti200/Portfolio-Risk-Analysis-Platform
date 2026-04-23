package com.portfolio.risk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = {
    org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration.class
})
@EnableScheduling
public class RiskEngineServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(RiskEngineServiceApplication.class, args);
		System.out.println("Risk Engine Service is running on port 8082...");
	}

}
