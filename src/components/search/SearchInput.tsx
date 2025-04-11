"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  onEnter,
  placeholder
}: SearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shiftキーが押されていないEnter押下で送信
    if (e.key === "Enter" && !e.shiftKey && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <Textarea
      value={value || ""}
      onChange={(e) => {
        // ★ここでスペースや任意の文字をそのまま許可★
        onChange(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder || "複数キーワードやフレーズをそのまま入力できます"}
      className="min-h-[80px] resize-none"
    />
  );
}