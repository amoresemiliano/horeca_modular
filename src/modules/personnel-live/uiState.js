import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { readContext, saveContext } from '../../context/navigationState';

// UI preferences only. Mounted only after normal organization/unit authorization.
export function usePersonnelUi(name, initial) {
  const { user, activeOrganization, activeOperationalUnit } = useAuth();
  const key = `${activeOrganization?.id || ''}:${activeOperationalUnit?.id || ''}:${name}`;
  const load = () => readContext(user?.id).personnelUi?.[key] ?? (typeof initial === 'function' ? initial() : initial);
  const [stored, setStored] = useState(() => ({ key, value: load() }));
  const value = stored.key === key ? stored.value : load();
  const current = useRef(null);
  current.current = { key, value, userId:user?.id };
  const setValue = useCallback(update => {
    const {key,value,userId} = current.current;
    const next = typeof update === 'function' ? update(value) : update;
    if (Object.is(next,value)) return;
    current.current.value = next;
    setStored({ key, value: next });
    saveContext(userId, { personnelUi: { ...readContext(userId).personnelUi, [key]: next } });
  },[]);
  return [value, setValue];
}
