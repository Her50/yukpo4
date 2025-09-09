import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/buttons';
import { Eye, MapPin, Star, Clock } from 'lucide-react';

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  location?: string;
  rating?: number;
  image?: string;
  isActive: boolean;
  createdAt: string;
}

interface ServiceListProps {
  services: Service[];
  loading?: boolean;
  onServiceClick?: (service: Service) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

// Composant de service individuel optimisé
const ServiceCard = React.memo<{
  service: Service;
  onClick?: (service: Service) => void;
}>(({ service, onClick }) => {
  const handleClick = useCallback(() => {
    onClick?.(service);
  }, [service, onClick]);

  const formatPrice = useMemo(() => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(service.price);
  }, [service.price]);

  const formatDate = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(service.createdAt));
  }, [service.createdAt]);

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        !service.isActive ? 'opacity-60' : ''
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image du service */}
          <div className="flex-shrink-0">
            {service.image ? (
              <img
                src={service.image}
                alt={service.title}
                className="w-16 h-16 object-cover rounded-lg"
                loading="lazy"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-400 text-xs">No image</span>
              </div>
            )}
          </div>

          {/* Contenu du service */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {service.title}
              </h3>
              <span className="text-sm font-medium text-green-600">
                {formatPrice}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
              {service.description}
            </p>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {service.category}
              </span>
              
              {service.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  <span className="truncate">{service.location}</span>
                </div>
              )}

              {service.rating && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-current" />
                  <span>{service.rating.toFixed(1)}</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{formatDate}</span>
              </div>
            </div>
          </div>

          {/* Statut actif/inactif */}
          {!service.isActive && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                Inactif
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

ServiceCard.displayName = 'ServiceCard';

// Composant de skeleton pour le loading
const ServiceSkeleton = React.memo(() => (
  <Card className="mb-4">
    <CardContent className="p-4">
      <div className="flex gap-4">
        <Skeleton className="w-16 h-16 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
));

ServiceSkeleton.displayName = 'ServiceSkeleton';

// Composant principal de liste optimisé
const ServiceList: React.FC<ServiceListProps> = ({
  services,
  loading = false,
  onServiceClick,
  onLoadMore,
  hasMore = false,
  className = ''
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Configuration de la virtualisation
  const rowVirtualizer = useVirtualizer({
    count: services.length + (loading ? 5 : 0) + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Hauteur estimée d'une carte
    overscan: 5, // Nombre d'éléments à pré-rendre
  });

  // Intersection Observer pour le lazy loading
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    const options = {
      root: parentRef.current,
      rootMargin: '100px',
      threshold: 0.1,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          onLoadMore();
        } else {
          setIsIntersecting(false);
        }
      });
    }, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, onLoadMore]);

  // Mémoïsation des éléments virtuels
  const virtualItems = useMemo(() => {
    return rowVirtualizer.getVirtualItems();
  }, [rowVirtualizer]);

  // Gestion du clic sur un service
  const handleServiceClick = useCallback((service: Service) => {
    onServiceClick?.(service);
  }, [onServiceClick]);

  // Rendu d'un élément de la liste
  const renderItem = useCallback((index: number) => {
    if (index < services.length) {
      return (
        <ServiceCard
          key={services[index].id}
          service={services[index]}
          onClick={handleServiceClick}
        />
      );
    }

    if (loading && index < services.length + 5) {
      return <ServiceSkeleton key={`skeleton-${index}`} />;
    }

    if (hasMore && index === services.length + (loading ? 5 : 0)) {
      return (
        <div key="load-more" className="flex justify-center p-4">
          <Button
            onClick={onLoadMore}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Chargement...' : 'Charger plus'}
          </Button>
        </div>
      );
    }

    return null;
  }, [services, loading, hasMore, onLoadMore, handleServiceClick]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Statistiques rapides */}
      {services.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span>{services.length} service{services.length > 1 ? 's' : ''} trouvé{services.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {services.filter(s => s.isActive).length} actifs
            </span>
          </div>
        </div>
      )}

      {/* Liste virtuelle */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto"
        style={{
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(virtualItem.index)}
            </div>
          ))}
        </div>
      </div>

      {/* État vide */}
      {!loading && services.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Eye size={48} className="mx-auto mb-4" />
            <h3 className="text-lg font-medium">Aucun service trouvé</h3>
            <p className="text-sm">Essayez de modifier vos critères de recherche</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ServiceList); 