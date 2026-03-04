export interface CweDataFile {
  view_id: string;
  view_name: string;
  weaknesses: CweWeakness[];
}

export interface CweWeakness {
  cwe_id: string;
  name: string;
  description: string;
  extended_description: string;
  parent_id: string;
}
