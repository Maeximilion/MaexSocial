ALTER TABLE pilot.audit ADD COLUMN approval_id uuid,
    ADD CHECK ((action = 'approval_withdrawal') = (approval_id IS NOT NULL)
        AND (approval_id IS NULL OR occurrence_id IS NOT NULL)),
    ADD FOREIGN KEY (tenant_id, occurrence_id, approval_id)
        REFERENCES pilot.approvals(tenant_id, occurrence_id, id);
CREATE UNIQUE INDEX audit_approval_withdrawal
    ON pilot.audit(tenant_id, occurrence_id, approval_id) WHERE action = 'approval_withdrawal';
