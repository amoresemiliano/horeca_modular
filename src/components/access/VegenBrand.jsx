import platformLogo from '../../assets/vegen-digital.png';

// Crop only the existing asset's whitespace; never redraw the brand mark.
export default function VegenBrand({ negative = false, leaf = false, decorative = false }) {
  return (
    <span className={`access-brand${negative ? ' access-brand--negative' : ''}${leaf ? ' access-brand--leaf' : ''}`} aria-hidden={decorative || undefined}>
      <img src={platformLogo} alt={decorative ? '' : 'Vegen Digital'} />
    </span>
  );
}
