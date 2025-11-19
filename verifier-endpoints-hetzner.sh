#!/bin/bash
# Script de verification des endpoints metriques depuis Hetzner

BACKEND_URL="https://yukpomnang.onrender.com"

echo "Verification des endpoints metriques du backend Render"
echo "URL: $BACKEND_URL"
echo ""

endpoints=(
    "/metrics:Metriques principales"
    "/healthz:Health check"
    "/internal/metrics/pipeline:Metriques pipeline"
    "/metrics/delivery:Metriques delivery"
    "/internal/metrics/preview:Metriques preview"
)

ok_count=0
total_count=${#endpoints[@]}

for endpoint_info in "${endpoints[@]}"; do
    IFS=':' read -r path name <<< "$endpoint_info"
    url="$BACKEND_URL$path"
    
    echo "Test: $name ($path)"
    
    response=$(curl -k -s -w "\n%{http_code}" "$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    content=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "200" ]; then
        content_length=${#content}
        first_lines=$(echo "$content" | head -n 3 | tr '\n' ' | ')
        
        echo "   OK Status: $http_code"
        echo "   Taille: $content_length caracteres"
        echo "   Premieres lignes: $first_lines"
        ((ok_count++))
    else
        echo "   ERREUR: HTTP $http_code"
        if [ -n "$content" ]; then
            echo "   Message: $(echo "$content" | head -n 1)"
        fi
    fi
    echo ""
done

echo "Resume:"
echo "Endpoints accessibles: $ok_count/$total_count"

if [ $ok_count -eq $total_count ]; then
    echo "Tous les endpoints sont accessibles!"
    exit 0
else
    echo "Certains endpoints ne sont pas accessibles."
    exit 1
fi

