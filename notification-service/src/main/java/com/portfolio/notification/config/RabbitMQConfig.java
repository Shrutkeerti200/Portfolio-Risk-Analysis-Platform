package com.portfolio.notification.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String ALERT_QUEUE = "alert-notifications";
    public static final String ALERT_EXCHANGE = "risk.alerts.exchange";
    public static final String ALERT_ROUTING_KEY = "risk.alert";

    public static final String PORTFOLIO_QUEUE = "portfolio-recalculation";
    public static final String PORTFOLIO_EXCHANGE = "portfolio.events.exchange";
    public static final String PORTFOLIO_ROUTING_KEY = "portfolio.changed";

    @Bean
    public Queue alertQueue() {
        return QueueBuilder.durable(ALERT_QUEUE).build();
    }

    @Bean
    public DirectExchange alertExchange() {
        return new DirectExchange(ALERT_EXCHANGE);
    }

    @Bean
    public Binding alertBinding(Queue alertQueue, DirectExchange alertExchange) {
        return BindingBuilder.bind(alertQueue).to(alertExchange).with(ALERT_ROUTING_KEY);
    }
    
    @Bean
    public Queue portfolioQueue() {
        return QueueBuilder.durable(PORTFOLIO_QUEUE).build();
    }

    @Bean
    public DirectExchange portfolioExchange() {
        return new DirectExchange(PORTFOLIO_EXCHANGE);
    }

    @Bean
    public Binding portfolioBinding(Queue portfolioQueue, DirectExchange portfolioExchange) {
        return BindingBuilder.bind(portfolioQueue).to(portfolioExchange).with(PORTFOLIO_ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}
