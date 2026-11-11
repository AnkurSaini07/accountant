insert into units (code, name, decimals) values (:code, :name, :decimals)
returning id, code, name, decimals, active
