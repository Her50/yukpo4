# Application Load Balancer pour le backend
resource "aws_lb" "backend" {
  name               = "yukpomnang-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false
  enable_http2               = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "Yukpomnang Backend ALB"
    Environment = var.environment
  }
}

# Security Group pour ALB
resource "aws_security_group" "alb" {
  name        = "yukpomnang-backend-alb-sg"
  description = "Security group for Backend ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Yukpomnang Backend ALB Security Group"
  }
}

# Target Group pour le backend
resource "aws_lb_target_group" "backend" {
  name        = "yukpomnang-backend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"  # Requis pour Fargate (awsvpc network mode)

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = {
    Name = "Yukpomnang Backend Target Group"
  }
}

# Listener HTTP (pointe directement vers le target group, pas de redirection HTTPS pour l'instant)
resource "aws_lb_listener" "backend_http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# Listener HTTPS (commenté - à activer si vous avez un certificat ACM)
# resource "aws_lb_listener" "backend_https" {
#   load_balancer_arn = aws_lb.backend.arn
#   port              = "443"
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
#   certificate_arn   = aws_acm_certificate.backend.arn
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.backend.arn
#   }
# }

# Certificat SSL (optionnel - commenté pour l'instant, à activer si vous avez un domaine)
# resource "aws_acm_certificate" "backend" {
#   domain_name       = var.backend_domain != "" ? var.backend_domain : "yukpomnang-backend.local"
#   validation_method = "DNS"
#   lifecycle {
#     create_before_destroy = true
#   }
#   tags = {
#     Name = "Yukpomnang Backend SSL Certificate"
#   }
# }
# resource "aws_acm_certificate_validation" "backend" {
#   certificate_arn = aws_acm_certificate.backend.arn
# }

# Output - URL du backend
output "backend_url" {
  value       = "https://${aws_lb.backend.dns_name}"
  description = "URL publique du backend pour Expo"
}

output "backend_dns" {
  value       = aws_lb.backend.dns_name
  description = "DNS du Load Balancer"
}

output "backend_zone_id" {
  value       = aws_lb.backend.zone_id
  description = "Zone ID du Load Balancer (pour Route53)"
}

