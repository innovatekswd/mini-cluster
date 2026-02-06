export interface Variable {
  key: string;
  value: string;
}

export interface Environment {
  id: string;
  name: string;
  slug: string;
  description?: string;
  variables: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
}

export type CreateEnvironmentDto = {
  name: string;
  description?: string;
  variables: Record<string, string>;
};

export type UpdateEnvironmentDto = Partial<CreateEnvironmentDto>;