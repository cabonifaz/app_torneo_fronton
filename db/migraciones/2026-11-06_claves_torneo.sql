-- Claves de acceso por torneo (hash scrypt "sal:hash"). NULL = ese rol no puede entrar hasta que
-- el super admin fije una clave. La clave del super admin vive en la variable SUPERADMIN_CLAVE.
ALTER TABLE torneo
  ADD COLUMN clave_admin VARCHAR(200) NULL AFTER es_prueba,
  ADD COLUMN clave_arbitro VARCHAR(200) NULL AFTER clave_admin;
