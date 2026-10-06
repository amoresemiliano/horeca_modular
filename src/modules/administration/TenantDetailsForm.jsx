import { useState } from 'react';

export const TENANT_FIELDS = [
  ['name','Nombre visible'], ['code','Código único'], ['trade_name','Nombre comercial'],
  ['legal_name','Razón social'], ['tax_id','CIF / NIF'], ['tax_id_type','Tipo de identificación fiscal'],
  ['business_address','Dirección fiscal / comercial'], ['country_code','País (ISO, por ejemplo ES)'],
  ['currency','Moneda base (ISO, por ejemplo EUR)'], ['timezone','Zona horaria'],
  ['contact_email','Correo de contacto'], ['contact_phone','Teléfono de contacto'],
];
export default function TenantDetailsForm({ tenant, disabled, onSave }) {
  const [values,setValues] = useState(Object.fromEntries(TENANT_FIELDS.map(([key])=>[key,tenant?.[key] ?? ({country_code:'ES',currency:'EUR',timezone:'Europe/Madrid',tax_id_type:'CIF'}[key] || '')])));
  return <form className="space-y-4" onSubmit={e=>{e.preventDefault();onSave(values)}}>
    <p className="text-gray-600">Los datos legales y de contacto son opcionales. Introduce únicamente información confirmada.</p>
    <div className="grid sm:grid-cols-2 gap-4">{TENANT_FIELDS.map(([key,label])=><label key={key} className="block">{label}
      {key==='tax_id_type'?<select className="block border rounded p-2 w-full" disabled={disabled} value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})}>{['CIF','NIF','NIE','VAT','OTHER'].map(v=><option key={v}>{v}</option>)}</select>:
      <input className="block border rounded p-2 w-full" disabled={disabled} required={['name','code','country_code','currency','timezone'].includes(key)} type={key==='contact_email'?'email':key==='contact_phone'?'tel':'text'} maxLength={key==='business_address'?1000:key==='code'?80:200} value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})}/>}
    </label>)}</div>
    <button disabled={disabled} className="border rounded px-4 py-2 bg-white">{tenant?'Guardar información del tenant':'Crear tenant'}</button>
  </form>;
}
