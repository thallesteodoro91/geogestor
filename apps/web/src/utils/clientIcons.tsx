import farmerIcon from '../assets/magnific-icons/man_7666985.svg';
import skyscraperIcon from '../assets/magnific-icons/skyscraper_8810808.svg';
import embassyIcon from '../assets/magnific-icons/embassy_10524074.svg';
import factoryIcon from '../assets/magnific-icons/factory_2786505.svg';
import userIcon from '../assets/magnific-icons/user_3237472.svg';
import lawyerIcon from '../assets/magnific-icons/lawyer_5192714.svg';
import agreementIcon from '../assets/magnific-icons/agreement_5426856.svg';
import shopIcon from '../assets/magnific-icons/shop_8942987.svg';

const normalizeCategory = (category?: string | null) =>
  (category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function getClientCategoryIcon(category?: string | null, className: string = 'w-5 h-5') {
  const cat = normalizeCategory(category);

  if (cat.includes('agricultor') || cat.includes('agricola') || cat.includes('agro') || cat.includes('rural') || cat.includes('produtor')) {
    return <img src={farmerIcon} alt="Agricultor / Produtor Rural" className={className} />;
  }
  if (cat.includes('juridica')) {
    return <img src={lawyerIcon} alt="Pessoa Juridica" className={className} />;
  }
  if (cat.includes('empresa')) {
    return <img src={skyscraperIcon} alt="Empresa" className={className} />;
  }
  if (cat.includes('parceiro') || cat.includes('parceria')) {
    return <img src={agreementIcon} alt="Parceiro" className={className} />;
  }
  if (cat.includes('publico') || cat.includes('prefeitura') || cat.includes('orgao')) {
    return <img src={embassyIcon} alt="Orgao Publico" className={className} />;
  }
  if (cat.includes('industria')) {
    return <img src={factoryIcon} alt="Industria" className={className} />;
  }
  if (cat.includes('comercio') || cat.includes('shop')) {
    return <img src={shopIcon} alt="Comercio" className={className} />;
  }

  return <img src={userIcon} alt="Pessoa Fisica" className={className} />;
}

export function getClientCategoryColorClass(category?: string | null) {
  void category;
  // Keep the custom SVG category icons visually clean, without extra backgrounds or borders.
  return '';
}
