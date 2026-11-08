---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Tokens robados a una integración SaaS"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Tokens robados a una integración SaaS

Unos atacantes comprometen a un proveedor SaaS y usan sus tokens de integración para exportar los datos del CRM de sus clientes, incluidos casos de soporte donde la plantilla pegó contraseñas y claves cloud. El ejercicio pone a prueba la visibilidad sobre terceros, acotar el alcance con pocos registros, rotar secretos y decidir la notificación.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Exposición de la integración acotada
- **OBJ-02** Brecha clasificada
- **OBJ-03** Notificación decidida

## Escenario

Un lunes por la mañana, la plataforma de CRM que usa {organization} revoca todos los tokens de la integración de un chatbot de ventas y publica un aviso. El equipo comercial solo quiere que vuelva el chatbot.

## Fases e injects

### PH-01 El aviso del proveedor

Lunes, 08:30. La plataforma de CRM revoca todos los tokens de la integración de un chatbot de ventas.

- **INJ-01** (T+5′) Revocados todos los tokens de una integración
- **INJ-02** (T+25′) Ventas quiere que vuelva el chatbot

### PH-02 Lo que salió

Día 2. Los registros muestran exportaciones masivas hace tres semanas.

- **INJ-03** (T+55′) Exportaciones masivas hace tres semanas
- **INJ-04** (T+80′) Secretos en casos de soporte, uno ya usado

### PH-03 Clientes y reguladores

Día 4. Los clientes empiezan a preguntar.

- **INJ-05** (T+115′) Asesoría: ¿es una brecha de datos personales?
- **INJ-06** (T+140′) Un gran cliente pregunta

## Actores simulados

- **ACT-01** Proveedor cloud
- **ACT-02** Empleado
- **ACT-03** SOC
- **ACT-04** Asesoría legal externa
- **ACT-05** Cliente

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Tokens robados a una integración SaaS",
    "description": "Unos atacantes comprometen a un proveedor SaaS y usan sus tokens de integración para exportar los datos del CRM de sus clientes, incluidos casos de soporte donde la plantilla pegó contraseñas y claves cloud. El ejercicio pone a prueba la visibilidad sobre terceros, acotar el alcance con pocos registros, rotar secretos y decidir la notificación."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "regulatory"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "incident_classification",
      "regulatory_notification",
      "third_party_supply_chain"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Operaciones de seguridad",
      "TI",
      "Ventas",
      "Delegado de protección de datos",
      "Legal",
      "Comunicación",
      "CISO",
      "Responsable de operaciones de seguridad",
      "Director de TI",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Proveedor SaaS",
      "Plataforma de CRM"
    ],
    "perimeter": "El CRM, sus integraciones de terceros, los secretos que contiene y los equipos de seguridad, protección de datos y comunicación.",
    "out_of_scope": "Sustituir la plataforma de CRM.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "LOST TOKEN",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Integraciones con el CRM sin inventariar",
        "finding": "Los equipos de negocio conectan herramientas SaaS al CRM con permisos amplios; seguridad no sabe cuáles.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Difícil acotar qué exportó una integración",
        "finding": "Los registros de auditoría del SaaS duran poco y los casos de soporte contienen secretos pegados.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación de brechas de terceros sin ensayar",
        "finding": "Nunca se ha ensayado el plazo de 72 horas para una brecha ocurrida en un proveedor.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Exposición de la integración acotada",
        "statement": "El equipo encuentra al responsable de la integración y a qué tenía acceso, y la mantiene desconectada hasta acotarlo.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Responsable y accesos documentados\nIntegración desconectada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Revisión de la integración.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Brecha clasificada",
        "statement": "El equipo determina qué se exportó, qué secretos contenía, y los rota.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Alcance de la exportación estimado\nSecretos rotados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Notas de la investigación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Notificación decidida",
        "statement": "El equipo decide si es una brecha de datos personales, cuándo empezó el plazo y qué se dice a los clientes.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Decisión de notificación documentada\nMensaje a clientes aprobado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la brecha.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave de parada."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "La integración que no era de nadie",
    "summary": "Un lunes por la mañana, la plataforma de CRM que usa {organization} revoca todos los tokens de la integración de un chatbot de ventas y publica un aviso. El equipo comercial solo quiere que vuelva el chatbot.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "El aviso del proveedor",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Lunes, 08:30. La plataforma de CRM revoca todos los tokens de la integración de un chatbot de ventas.",
        "key_questions": [
          "¿Qué podía leer esta integración?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Una integración que no conocíamos"
      },
      {
        "code": "PH-02",
        "name": "Lo que salió",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Día 2. Los registros muestran exportaciones masivas hace tres semanas.",
        "key_questions": [
          "¿Qué secretos rotamos primero?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Exportaciones masivas y secretos en casos de soporte"
      },
      {
        "code": "PH-03",
        "name": "Clientes y reguladores",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Día 4. Los clientes empiezan a preguntar.",
        "key_questions": [
          "¿Cuándo empezaron nuestras 72 horas?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Los clientes empiezan a preguntar"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo de robo de datos",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo sin identificar que comprometió a un proveedor SaaS y usó sus tokens de integración contra el CRM de sus clientes.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1528"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1550.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078.004"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Revocados todos los tokens de una integración",
        "content": "La plataforma de CRM: tras una brecha en un proveedor externo, se han revocado todos los tokens de su integración de chatbot. Los clientes deben revisar la actividad de la API de la integración en los últimos 90 días y rotar las credenciales guardadas en el CRM.",
        "offset_minutes": 5,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "CISO",
          "TI"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1528"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Averigua quién es responsable de la integración y a qué tenía acceso.",
            "responsible_role": "CISO",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Ventas quiere que vuelva el chatbot",
        "content": "El responsable de ventas escribe: el chatbot se ha parado esta mañana, se están perdiendo oportunidades y pide a TI que «lo vuelva a conectar» hoy mismo.",
        "offset_minutes": 25,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "CISO",
          "Ventas"
        ],
        "delivery_method": "chat",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Mantiene la integración desconectada hasta acotarla y explica por qué.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Exportaciones masivas hace tres semanas",
        "content": "El SOC: la identidad de la integración lanzó consultas masivas hace tres semanas y exportó cuentas, contactos y casos de soporte. Los registros de auditoría se guardan 30 días, así que la actividad anterior se desconoce.",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "Delegado de protección de datos"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1550.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1213"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Estima qué se exportó y desde cuándo.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Secretos en casos de soporte, uno ya usado",
        "content": "Una búsqueda en los casos de soporte exportados encuentra contraseñas y claves de acceso cloud pegadas por la plantilla y por clientes. Una de las claves se usó ayer desde 198.51.100.77.",
        "offset_minutes": 80,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad",
          "TI"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1552.001"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1078.004"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Rota todos los secretos encontrados en los casos de soporte, empezando por la clave usada.",
            "responsible_role": "Director de TI",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Asesoría: ¿es una brecha de datos personales?",
        "content": "La asesoría externa: la exportación incluye datos de contacto de unos 40.000 clientes. Pregunta cuándo tuvo conocimiento {organization} y si las 72 horas ya han empezado a correr.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "Decide si notifica a la autoridad de protección de datos y deja constancia de cuándo empezó el plazo.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Un gran cliente pregunta",
        "content": "Un gran cliente ha leído sobre la brecha del proveedor y pregunta si sus datos y sus casos de soporte estaban en la exportación de vuestro CRM.",
        "offset_minutes": 140,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable de comunicación",
          "Delegado de protección de datos"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Acuerda y envía el mensaje a los clientes afectados.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "cloud-provider",
      "origin_name": "Proveedor cloud",
      "code": "ACT-01",
      "name": "Proveedor cloud",
      "type": "supplier",
      "description": "La plataforma cloud en la que corren los servicios afectados.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-02",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-03",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "Asesoría legal externa",
      "code": "ACT-04",
      "name": "Asesoría legal externa",
      "type": "other",
      "description": "Abogados externos que asesoran sobre notificaciones, responsabilidad y comunicación.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-05",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    }
  ],
  "next_actor_number": 6,
  "tags": [
    {
      "origin": "system",
      "origin_id": "supply-chain",
      "origin_name": "Cadena de suministro",
      "name": "Cadena de suministro",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "cloud",
      "origin_name": "Cloud",
      "name": "Cloud",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "data-breach",
      "origin_name": "Fuga de datos",
      "name": "Fuga de datos",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1
}
```
