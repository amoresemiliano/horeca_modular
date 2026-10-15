import VegenBrand from './VegenBrand';

export default function LoginPanel({ title, description, children }) {
  return (
    <section className="access-panel" aria-labelledby="access-panel-title">
      <div className="access-panel-inner">
        <header className="access-panel-header"><VegenBrand leaf /><h2 id="access-panel-title">{title}</h2><p>{description}</p></header>
        <div className="access-card">{children}</div>
        <p className="access-panel-footer">Vegen Digital SL ™</p>
      </div>
    </section>
  );
}
