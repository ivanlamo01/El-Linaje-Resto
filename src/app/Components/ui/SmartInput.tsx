"use client";
import React from 'react';

interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

export function SmartInput({ value, onChange, onValueChange, className, ...props }: SmartInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    if (newValue.length > 0) {
      newValue = newValue.charAt(0).toUpperCase() + newValue.slice(1);
    }
    
    if (onValueChange) {
      onValueChange(newValue);
    }
    
    if (onChange) {
      e.target.value = newValue;
      onChange(e);
    }
  };

  return (
    <input
      {...props}
      value={value}
      onChange={handleChange}
      className={`transition-all ${className}`}
    />
  );
}
