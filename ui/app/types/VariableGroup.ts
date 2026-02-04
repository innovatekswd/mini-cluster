export interface Variable {
  key: string;
  value: string;
}

export interface VariableGroup {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>; // Changed to Record<string, string>
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

export type CreateVariableGroupDto = {
  name: string;
  description?: string;
  variables: Record<string, string>; // Changed to Record<string, string>
};

export type UpdateVariableGroupDto = Partial<CreateVariableGroupDto>;