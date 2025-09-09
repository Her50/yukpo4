# Script pour optimiser la récupération des services
# Remplacement des appels individuels par un appel batch

$content = Get-Content "src/pages/ResultatBesoin.tsx" -Raw

# Remplacer la fonction fetchServicesByIds pour utiliser l'endpoint batch
$newFunction = @'
  const fetchServicesByIds = async (serviceIds: string[], originalResults: any[] = []) => {
    try {
      setLoading(true);
      setError(null);
      
      // Utiliser l'endpoint batch pour récupérer tous les services en une seule requête
      const response = await fetch('/api/services/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          service_ids: serviceIds.map(id => parseInt(id, 10))
        })
      });

      if (response.ok) {
        const batchData = await response.json();
        const services = batchData.services || [];
        
        // Enrichir les services avec les données de recherche (score, etc.)
        const enrichedServices = services.map((service: any) => {
          const originalResult = originalResults.find((result: any) => 
            result.service_id?.toString() === service.id?.toString()
          );
          
          return {
            ...service,
            score: originalResult?.score || 0,
            semantic_score: originalResult?.semantic_score || 0,
            interaction_score: originalResult?.interaction_score || 0,
            gps: originalResult?.gps || null
          };
        });

        if (enrichedServices.length === 0) {
          setError("Aucun service trouvé. Les services recherchés ne sont plus disponibles.");
          setServices([]);
        } else if (enrichedServices.length < serviceIds.length) {
          const missingCount = serviceIds.length - enrichedServices.length;
          console.warn(`⚠️ ${missingCount} services manquants sur ${serviceIds.length} demandés`);
          
          toast({
            title: "Services partiellement trouvés",
            description: `${enrichedServices.length} sur ${serviceIds.length} services trouvés`,
            type: "default"
          });
          
          setServices(enrichedServices);
        } else {
          setServices(enrichedServices);
        }
      } else {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des services:', error);
      setError('Erreur lors de la récupération des services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };
'@

# Trouver et remplacer la fonction existante
$pattern = 'const fetchServicesByIds = async \(serviceIds: string\[\], originalResults: any\[\] = \[\]\) => \{[\s\S]*?\};'
$content = $content -replace $pattern, $newFunction

# Sauvegarder le fichier optimisé
$content | Out-File "src/pages/ResultatBesoin.tsx" -Encoding UTF8

Write-Host "✅ Récupération des services optimisée avec endpoint batch!" 