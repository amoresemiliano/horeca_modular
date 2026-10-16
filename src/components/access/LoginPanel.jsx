import VegenBrand from './VegenBrand';

export default function LoginPanel({ title, description, children }) {
  return (
    <section className="access-panel" aria-labelledby="access-panel-title">
      <div className="access-panel-inner">
        <header className="access-panel-header"><VegenBrand leaf /><h2 id="access-panel-title">{title}</h2><p>{description}</p></header>
        <div className="access-card">{children}</div>
        <div className="access-panel-footer"><p>HORECA Modular · Portal Seguro</p><p>Uso restringido a operadores y personal autorizado</p></div>
      </div>
    </section>
  );
}
