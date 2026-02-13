# Instance EC2 temporaire pour créer la base de données
# Usage: terraform apply -target=aws_instance.temp_db_creator
# IMPORTANT: Supprimez cette ressource après usage avec: terraform destroy -target=aws_instance.temp_db_creator

# Rôle IAM pour SSM Session Manager
resource "aws_iam_role" "temp_ec2_ssm" {
  name = "${var.project_name}-temp-ec2-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name    = "${var.project_name}-temp-ec2-ssm-role"
    Purpose = "Temporary - Delete after database creation"
  }
}

# Politique pour SSM Session Manager
resource "aws_iam_role_policy_attachment" "temp_ec2_ssm" {
  role       = aws_iam_role.temp_ec2_ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Permission pour accéder à Secrets Manager
# Note: backend_secrets est défini dans main.tf, on construit l'ARN manuellement
data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "temp_ec2_secrets" {
  name = "${var.project_name}-temp-ec2-secrets-policy"
  role = aws_iam_role.temp_ec2_ssm.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/backend/secrets-*"
      }
    ]
  })
}

# Instance profile pour attacher le rôle à l'instance EC2
resource "aws_iam_instance_profile" "temp_ec2_ssm" {
  name = "${var.project_name}-temp-ec2-ssm-profile"
  role = aws_iam_role.temp_ec2_ssm.name

  tags = {
    Name    = "${var.project_name}-temp-ec2-ssm-profile"
    Purpose = "Temporary - Delete after database creation"
  }
}

resource "aws_security_group" "temp_ec2" {
  name        = "${var.project_name}-temp-ec2-sg"
  description = "Security group for temporary EC2 instance to create database"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # ⚠️ Modifiez pour limiter à votre IP
    description = "SSH access for database creation"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-temp-ec2-sg"
    Purpose = "Temporary - Delete after database creation"
  }
}

# Récupérer la dernière AMI Amazon Linux 2023
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "temp_db_creator" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.micro"
  
  # Utiliser une subnet publique
  subnet_id = aws_subnet.public[0].id
  
  # Security group
  vpc_security_group_ids = [aws_security_group.temp_ec2.id]
  
  # Rôle IAM pour SSM Session Manager
  iam_instance_profile = aws_iam_instance_profile.temp_ec2_ssm.name
  
  # Clé SSH (à créer manuellement ou via AWS Console)
  # key_name = "yukpo-key"  # Décommentez et remplacez par votre clé
  
  # Activer l'IP publique
  associate_public_ip_address = true

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y postgresql15
              EOF

  tags = {
    Name = "${var.project_name}-temp-db-creator"
    Purpose = "Temporary - Delete after database creation"
  }
}

output "temp_ec2_public_ip" {
  description = "Public IP of the temporary EC2 instance"
  value       = aws_instance.temp_db_creator.public_ip
}

output "temp_ec2_ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh ec2-user@${aws_instance.temp_db_creator.public_ip}"
}

output "create_database_command" {
  description = "Command to create the database once connected"
  sensitive   = true
  value = <<-EOT
    export PGPASSWORD='${var.rds_password}'
    psql -h ${aws_db_instance.main.endpoint} \
         -U ${var.rds_username} \
         -d postgres \
         -c "CREATE DATABASE ${var.rds_database_name};"
  EOT
}

