"use client";
import React, { useState, useEffect } from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | undefined | null;
  onValueChange: (value: number) => void;
}

export function NumberInput({ value, onValueChange, className, ...props }: NumberInputProps) {
  const [inputValue, setInputValue] = useState<string>("");

  // Sync internal string state with external number prop when prop changes efficiently
  useEffect(() => {
    // Treat 0 or null/undefined as empty string to allow placeholder to show
    if (value === undefined || value === null || value === 0) {
      setInputValue("");
    } else {
        const currentParsed = parseFloat(inputValue);
        if (inputValue === "" || isNaN(currentParsed) || currentParsed !== value) {
             // Use same logic: max 3 decimals, no trailing zeros
             setInputValue(Number(value.toFixed(3)).toString());
        }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);

    // Allow empty string
    if (newVal === "") {
        onValueChange(0); 
        return;
    }

    // Force explicit "0" to clear if mapped to 0 (optional UX choice) 
    // but usually user typing 0 means 0. 
    // However, since we map value 0 -> "", we should probably map input "0" -> "" immediately
    // so it shows as empty (placeholder 0).
    if (newVal === "0") {
        setInputValue("");
        onValueChange(0);
        return;
    }

    // Allow typing decimal point
    if (newVal === "." || newVal.endsWith(".")) {
        return; 
    }
    
    // Allow typing only a minus sign (for negative numbers)
    if (newVal === "-") {
        return;
    }

    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onValueChange(parsed);
    }
  };

  // Helper: Smart Format (max 3 decimals, no trailing zeros)
  const formatValue = (val: number): string => {
      // 1. Cap at 3 decimals
      const capped = Number(val.toFixed(3));
      // 2. Convert to string (automatically drops trailing zeros for valid numbers)
      return capped.toString();
  };

  const handleBlur = () => {
      // On blur, force sync to formatted number if valid
      if (value !== undefined && value !== null && value !== 0) {
          setInputValue(formatValue(value));
      } else {
          setInputValue("");
      }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      if (props.onFocus) props.onFocus(e);
  };

  return (
    <input
      {...props}
      type="text" // Use text to allow full control over "4." and "-."
      inputMode="decimal" // Mobile numeric keyboard
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={`transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  );
}
