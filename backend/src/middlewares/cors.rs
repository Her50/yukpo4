use axum::{
    http::HeaderValue,
    response::Response,
    extract::Request,
    middleware::Next,
};
use crate::config::cloud_architecture::CORSConfig;

pub async fn cors_middleware(
    request: Request,
    next: Next,
) -> Response {
    // Extraire l'origin avant de consommer la request
    let origin = request.headers().get("origin").cloned();
    
    let mut response = next.run(request).await;
    
    let config = CORSConfig {
        allowed_origins: vec![
            // 🌍 Domaine principal
            "https://yukpomnang.com".to_string(),
            
            // 🚀 Plateformes de déploiement spécialisées
            "https://yukpomnang.vercel.app".to_string(),
            "https://yukpomnang.netlify.app".to_string(),
            "https://yukpomnang.pages.dev".to_string(), // Cloudflare Pages
            "https://yukpomnang.railway.app".to_string(),
            "https://yukpomnang.up.railway.app".to_string(),
            "https://yukpomnang.herokuapp.com".to_string(),
            "https://yukpomnang.onrender.com".to_string(),
            "https://yukpomnang.surge.sh".to_string(),
            
            // ☁️ Cloud Providers
            "https://yukpomnang.azurewebsites.net".to_string(), // Azure
            "https://yukpomnang.appspot.com".to_string(), // Google App Engine
            "https://yukpomnang.run.app".to_string(), // Google Cloud Run
            "https://yukpomnang.firebaseapp.com".to_string(), // Firebase Hosting
            "https://yukpomnang.web.app".to_string(), // Firebase Hosting
            "https://yukpomnang.aws.amazon.com".to_string(), // AWS
            "https://yukpomnang.s3-website.amazonaws.com".to_string(), // AWS S3
            "https://yukpomnang.cloudfront.net".to_string(), // AWS CloudFront
            "https://yukpomnang.amplifyapp.com".to_string(), // AWS Amplify
            
            // 🏢 Plateformes d'hébergement traditionnel
            "https://yukpomnang.digitalocean.app".to_string(), // DigitalOcean
            "https://yukpomnang.linode.com".to_string(), // Linode
            "https://yukpomnang.vultr.com".to_string(), // Vultr
            
            // 🔧 Plateformes de développement
            "https://yukpomnang.gitlab.io".to_string(), // GitLab Pages
            "https://yukpomnang.github.io".to_string(), // GitHub Pages
            "https://yukpomnang.bitbucket.io".to_string(), // Bitbucket
            
            // 🐳 Plateformes de conteneurisation (domaines personnalisés)
            "https://yukpomnang.docker.com".to_string(),
            "https://yukpomnang.k8s.com".to_string(),
            
            // 🌐 Développement local
            "http://localhost:3000".to_string(),
            "http://localhost:5173".to_string(),
            "http://localhost:8080".to_string(),
            "http://127.0.0.1:3000".to_string(),
            "http://127.0.0.1:5173".to_string(),
            "http://127.0.0.1:8080".to_string(),
            
            // 🔄 Environnements de test
            "https://staging.yukpomnang.com".to_string(),
            "https://dev.yukpomnang.com".to_string(),
            "https://test.yukpomnang.com".to_string(),
        ],
        allowed_methods: vec!["GET".to_string(), "POST".to_string(), "PUT".to_string(), "DELETE".to_string(), "OPTIONS".to_string(), "PATCH".to_string()],
        allowed_headers: vec![
            "Content-Type".to_string(), 
            "Authorization".to_string(), 
            "X-Requested-With".to_string(),
            "Accept".to_string(),
            "Origin".to_string(),
            "Access-Control-Request-Method".to_string(),
            "Access-Control-Request-Headers".to_string(),
            "Cache-Control".to_string(),
            "Pragma".to_string(),
        ],
        allow_credentials: true,
        max_age: std::time::Duration::from_secs(86400),
    };
    
    // Ajouter les headers CORS
    if let Some(origin) = origin {
        if config.allowed_origins.contains(&origin.to_str().unwrap_or("").to_string()) {
            response.headers_mut().insert(
                "access-control-allow-origin",
                origin,
            );
        } else {
            // Pour les domaines non listés, utiliser l'origin si c'est un domaine valide
            let origin_str = origin.to_str().unwrap_or("");
            if origin_str.contains("yukpomnang") || origin_str.contains("yukpo") || origin_str.contains("localhost") || origin_str.contains("127.0.0.1") {
                response.headers_mut().insert(
                    "access-control-allow-origin",
                    origin,
                );
            }
        }
    }
    
    // Headers CORS standards
    response.headers_mut().insert(
        "access-control-allow-credentials",
        HeaderValue::from_static("true"),
    );
    
    response.headers_mut().insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
    );
    
    response.headers_mut().insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma"),
    );
    
    response.headers_mut().insert(
        "access-control-max-age",
        HeaderValue::from_static("86400"),
    );
    
    response
}

pub async fn cors_preflight_handler() -> Response {
    let mut response = Response::new(axum::body::Body::empty());
    
    response.headers_mut().insert(
        "access-control-allow-origin",
        HeaderValue::from_static("*"),
    );
    
    response.headers_mut().insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS, PATCH"),
    );
    
    response.headers_mut().insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma"),
    );
    
    response.headers_mut().insert(
        "access-control-max-age",
        HeaderValue::from_static("86400"),
    );
    
    *response.status_mut() = axum::http::StatusCode::OK;
    
    response
}
