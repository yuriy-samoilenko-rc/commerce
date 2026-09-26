-- An issued document is never edited or deleted; the only allowed change is voiding it.
CREATE FUNCTION protect_issued_documents() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'documents cannot be deleted; cancel the document instead';
  END IF;
  IF NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."number" IS DISTINCT FROM OLD."number"
     OR NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt"
     OR NEW."data" IS DISTINCT FROM OLD."data"
     OR NEW."total" IS DISTINCT FROM OLD."total"
     OR NEW."counterpartyName" IS DISTINCT FROM OLD."counterpartyName" THEN
    RAISE EXCEPTION 'issued documents are immutable; only their status can change';
  END IF;
  IF OLD."status" = 'CANCELLED' THEN
    RAISE EXCEPTION 'a cancelled document cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_protect
  BEFORE UPDATE OR DELETE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION protect_issued_documents();
