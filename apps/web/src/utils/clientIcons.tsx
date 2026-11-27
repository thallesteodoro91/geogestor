import farmerIcon from '../assets/magnific-icons/man_7666985.svg';
import skyscraperIcon from '../assets/magnific-icons/skyscraper_8810808.svg';
import embassyIcon from '../assets/magnific-icons/embassy_10524074.svg';
import factoryIcon from '../assets/magnific-icons/factory_2786505.svg';
import shopIcon from '../assets/magnific-icons/shop_8942987.svg';
import { Tag } from '@phosphor-icons/react';
import { clientCategoryIconKind } from '@geogestor/contracts/src/client-categories';

export function getClientCategoryIcon(category?: string | null, className: string = 'w-5 h-5') {
  const kind = clientCategoryIconKind(category);
  if (kind === 'neutral') return <Tag aria-hidden="true" weight="regular" className={`${className} text-zinc-500 dark:text-zinc-300`} />;
  const src = kind === 'rural' ? farmerIcon
    : kind === 'business' ? skyscraperIcon
      : kind === 'public' ? embassyIcon
        : kind === 'industry' ? factoryIcon
          : shopIcon;
  return <img src={src} alt="" aria-hidden="true" className={className} />;
}

export function getClientCategoryColorClass(category?: string | null) {
  void category;
  // Keep the custom SVG category icons visually clean, without extra backgrounds or borders.
  return '';
}
