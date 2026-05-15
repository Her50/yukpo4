# Configuration Route 53 pour pointer vers CloudFront pour .well-known
# Utilisation: terraform apply -target=aws_route53_record.well_known

variable "well_known_hosted_zone_id" {
  description = "ID de la hosted zone Route 53 pour yukpomnang.com"
  type        = string
  default     = ""  # À remplir avec votre hosted zone ID
}

# Variable déjà déclarée dans cloudfront-well-known.tf
# variable "well_known_domain_name" {
#   description = "Nom de domaine pour les fichiers .well-known"
#   type        = string
#   default     = "yukpomnang.com"
# }

# Data source pour la hosted zone existante
data "aws_route53_zone" "well_known" {
  count   = var.well_known_hosted_zone_id != "" ? 1 : 0
  zone_id = var.well_known_hosted_zone_id
}

# Enregistrement Route 53 pour .well-known via CloudFront
# Option 1: CNAME (si vous voulez un sous-domaine .well-known.yukpomnang.com)
resource "aws_route53_record" "well_known_cname" {
  count   = var.well_known_hosted_zone_id != "" ? 1 : 0
  zone_id = var.well_known_hosted_zone_id
  name    = ".well-known.${var.well_known_domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.well_known.domain_name]
}

# Option 2: A (alias) pour le root domain (recommandé)
# Note: Cela nécessite que CloudFront soit configuré avec un certificat ACM
# Pour l'instant, on utilise le certificat CloudFront par défaut
# Vous devrez créer un certificat ACM dans us-east-1 et l'ajouter à CloudFront

# Enregistrement Route 53 pour le root domain pointant vers CloudFront
# Décommentez et configurez si vous avez un certificat ACM
# resource "aws_route53_record" "well_known_root" {
#   zone_id = var.well_known_hosted_zone_id
#   name    = var.well_known_domain_name
#   type    = "A"
#   
#   alias {
#     name                   = aws_cloudfront_distribution.well_known.domain_name
#     zone_id               = aws_cloudfront_distribution.well_known.hosted_zone_id
#     evaluate_target_health = false
#   }
# }

# Outputs
output "well_known_cname_record" {
  description = "Enregistrement CNAME créé pour .well-known"
  value       = var.well_known_hosted_zone_id != "" ? aws_route53_record.well_known_cname[0].fqdn : "Non configuré (hosted zone ID manquant)"
}

