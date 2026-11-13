CREATE OR REPLACE FUNCTION create_reservation(
  p_id          text,
  p_event_id    uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
  p_items       jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       jsonb;
  v_type_id    uuid;
  v_quantity   int;
  v_capacity   int;
  v_sold       int;
BEGIN
  -- Lock and validate each ticket type within this transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_type_id  := (v_item->>'ticket_type_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    SELECT capacity, sold
      INTO v_capacity, v_sold
      FROM ticket_types
     WHERE id = v_type_id
       AND event_id = p_event_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ticket_type_not_found:%', v_type_id;
    END IF;

    IF v_sold + v_quantity > v_capacity THEN
      RAISE EXCEPTION 'capacity_exceeded:%', v_type_id;
    END IF;
  END LOOP;

  -- Insert reservation header
  INSERT INTO reservations (id, event_id, buyer_name, buyer_email, buyer_phone, status)
  VALUES (p_id, p_event_id, p_buyer_name, p_buyer_email, p_buyer_phone, 'active');

  -- Insert line items and increment sold counts
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_type_id  := (v_item->>'ticket_type_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
    VALUES (p_id, v_type_id, v_quantity);

    UPDATE ticket_types
       SET sold = sold + v_quantity
     WHERE id = v_type_id;
  END LOOP;

  RETURN p_id;
END;
$$;
