import assert from 'node:assert/strict';

// Hosted or local app assertions. The caller supplies an authenticated Playwright
// page and owns fixture lifecycle; this helper never provisions users or logs tokens.
export async function assertBanksProfile(page, profile) {
  assert(['admin','viewer','import'].includes(profile));
  await page.getByRole('heading',{name:'Movimientos bancarios',exact:true}).waitFor();
  await page.getByAltText('Vegen Digital',{exact:true}).waitFor();
  await page.getByAltText('Tenant El Criollo',{exact:true}).waitFor();
  assert.equal(await page.locator('header nav button').count(),1);
  assert((await page.locator('header nav').innerText()).includes('Bancos'));
  for(const name of ['Ventas','Inventario','Compras','Personal','Administración de plataforma','Administración de organización'])assert.equal(await page.getByRole('button',{name:new RegExp(name+'$')}).count(),0);
  for(const name of ['Resumen','Métricas'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),profile==='import'?0:1);
  assert.equal(await page.getByRole('button',{name:'Cargar',exact:true}).count(),profile==='viewer'?0:1);
  for(const name of ['Cuentas y categorías','Reglas'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),profile==='admin'?1:0);
}

export async function assertTenantAdminSections(page) {
  await page.getByRole('heading',{name:'Administración de organización',exact:true}).waitFor();
  for(const name of ['Información general','Usuarios y membresías','Perfiles y permisos','Alcance operativo','Auditoría'])await page.getByRole('button',{name,exact:true}).waitFor();
  // General information must not render the unrelated invitation/access forms.
  await page.getByRole('button',{name:'Información general',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Enviar invitación segura',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Aplicar perfil y reemplazar excepciones',exact:true}).count(),0);
}
