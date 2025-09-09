// src/types/role.ts

// Importe le type de base
export type BaseRole = "admin" | "user" | "public";

// Étend le type de base en ajoutant "client"
export type Role = BaseRole | "client";
