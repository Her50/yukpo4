# Configuration CloudFront pour servir les fichiers .well-known depuis S3
# Utilisation: terraform apply -target=aws_cloudfront_distribution.well_known

variable "well_known_s3_bucket" {
  description = "Nom du bucket S3 contenant les fichiers .well-known"
  type        = string
  default     = "yukpomnang-static"
}

variable "well_known_domain_name" {
  description = "Nom de domaine pour les fichiers .well-known"
  type        = string
  default     = "yukpomnang.com"
}

# Utilisation directe du nom du bucket (créé par le script PowerShell)
# Note: Le bucket existe déjà, on utilise juste son nom

# Configuration du bucket pour l'accès public (nécessaire pour .well-known)
resource "aws_s3_bucket_public_access_block" "well_known" {
  bucket = var.well_known_s3_bucket

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Policy pour permettre l'accès CloudFront via OAC
# Note: Cette policy sera créée après CloudFront pour avoir l'ARN
resource "aws_s3_bucket_policy" "well_known" {
  bucket = var.well_known_s3_bucket

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "arn:aws:s3:::${var.well_known_s3_bucket}/.well-known/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.well_known.arn
          }
        }
      }
    ]
  })

  depends_on = [
    aws_cloudfront_distribution.well_known,
    aws_s3_bucket_public_access_block.well_known
  ]
}

# Origin Access Control (OAC) pour CloudFront
resource "aws_cloudfront_origin_access_control" "well_known" {
  name                              = "well-known-oac"
  description                       = "OAC for .well-known files"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Response Headers Policy pour .well-known
resource "aws_cloudfront_response_headers_policy" "well_known" {
  name = "well-known-headers-policy"

  custom_headers_config {
    items {
      header   = "Content-Type"
      value    = "application/json"
      override = true
    }
    items {
      header   = "Cache-Control"
      value    = "no-cache, no-store, must-revalidate"
      override = true
    }
    items {
      header   = "Pragma"
      value    = "no-cache"
      override = true
    }
    items {
      header   = "Expires"
      value    = "0"
      override = true
    }
  }

  # CORS headers (séparés des custom headers)
  cors_config {
    access_control_allow_origins {
      items = ["*"]
    }
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_credentials = false
    access_control_max_age_sec        = 0
    origin_override                   = true
  }
}

# Distribution CloudFront pour .well-known
resource "aws_cloudfront_distribution" "well_known" {
  comment = "CloudFront distribution for .well-known files (Universal Links/App Links)"

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # Origin S3
  # Note: Le bucket est dans us-east-1 (créé par le script PowerShell)
  origin {
    domain_name              = "${var.well_known_s3_bucket}.s3.us-east-1.amazonaws.com"
    origin_id                = "S3-${var.well_known_s3_bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.well_known.id
  }

  # Comportement par défaut
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${var.well_known_s3_bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    # Headers importants pour .well-known
    forwarded_values {
      query_string = false
      headers      = ["Host"]
      cookies {
        forward = "none"
      }
    }

    # Cache settings pour .well-known (pas de cache agressif)
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0

    # Response headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.well_known.id
  }

  # Comportement spécifique pour .well-known
  ordered_cache_behavior {
    path_pattern     = "/.well-known/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.well_known_s3_bucket}"
    compress         = true

    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Host"]
      cookies {
        forward = "none"
      }
    }

    # Pas de cache pour .well-known (important pour Universal Links/App Links)
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0

    # Response headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.well_known.id
  }

  # Restrictions géographiques (optionnel)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Certificat CloudFront par défaut (pour tester)
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # Custom error responses
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  tags = {
    Name        = "yukpomnang-well-known"
    Environment = "production"
    Purpose     = "Universal Links / App Links"
  }
}

# Outputs
output "cloudfront_distribution_id" {
  description = "ID de la distribution CloudFront"
  value       = aws_cloudfront_distribution.well_known.id
}

output "cloudfront_domain_name" {
  description = "Nom de domaine CloudFront"
  value       = aws_cloudfront_distribution.well_known.domain_name
}

output "s3_bucket_name" {
  description = "Nom du bucket S3"
  value       = var.well_known_s3_bucket
}

output "s3_bucket_arn" {
  description = "ARN du bucket S3"
  value       = "arn:aws:s3:::${var.well_known_s3_bucket}"
}
