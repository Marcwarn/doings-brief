update discovery_templates
set
  name = 'Perspektiv',
  updated_at = now()
where btrim(name) = 'Fördjupat underlag';

update discovery_templates
set
  intro_title = 'Perspektiv',
  updated_at = now()
where btrim(intro_title) = 'Fördjupa underlaget inför nästa steg';
