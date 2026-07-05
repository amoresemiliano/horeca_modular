import React, { useState, useEffect, useRef } from 'react';

const AutocompleteCell = ({ value, type, onSave, db, rowConcept }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const wrapperRef = useRef(null);

  // Generar lista de sugerencias únicas de la base de datos para este tipo (proveedor, categoria...)
  const allOptions = Array.from(new Set(db.map(item => item[type]).filter(v => v)));

  useEffect(() => {
    // Cerrar sugerencias si se hace click fuera
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsEditing(false);
        if (inputValue !== value) {
          onSave(inputValue);
        }
      }
    };
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, inputValue, value, onSave]);

  useEffect(() => {
    // Autocompletar sugerido inteligentemente basado en el concepto si el valor original está vacío
    if (!value && !isEditing) {
      const match = allOptions.find(opt => 
        rowConcept && opt && rowConcept.toLowerCase().includes(opt.toLowerCase())
      );
      if (match) {
        setInputValue(match);
      }
    }
  }, [value, rowConcept, allOptions, isEditing]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (val) {
      setSuggestions(allOptions.filter(opt => opt.toLowerCase().includes(val.toLowerCase())));
    } else {
      setSuggestions(allOptions);
    }
  };

  const handleSave = (finalValue) => {
    setIsEditing(false);
    if (finalValue !== value) {
      onSave(finalValue);
    }
  };

  const handleSelect = (val) => {
    setInputValue(val);
    handleSave(val);
  };

  if (!isEditing) {
    return (
      <div 
        className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 -ml-2 rounded"
        onClick={() => {
          setIsEditing(true);
          setSuggestions(allOptions);
        }}
      >
        {inputValue || <span className="text-gray-400 italic">Asignar...</span>}
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-[150px]" ref={wrapperRef}>
      <input
        autoFocus
        type="text"
        className="w-full border border-blue-400 rounded px-2 py-1 text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-100"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave(inputValue);
          if (e.key === 'Escape') {
            setInputValue(value || '');
            setIsEditing(false);
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
          {suggestions.map((s, i) => (
            <li 
              key={i} 
              className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer"
              onClick={() => handleSelect(s)}
            >
              {s}
            </li>
          ))}
          {!suggestions.includes(inputValue) && inputValue && (
            <li 
              className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer text-green-600 font-medium border-t border-gray-100"
              onClick={() => handleSelect(inputValue)}
            >
              + Crear "{inputValue}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteCell;