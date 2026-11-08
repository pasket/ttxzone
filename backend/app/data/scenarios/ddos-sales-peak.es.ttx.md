---
format: "ttx-zone.scenario"
format_version: 5
language: "es"
title: "DDoS hacktivista en plena campaña de ventas"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# DDoS hacktivista en plena campaña de ventas

Un grupo hacktivista anuncia y después lanza un ataque de denegación de servicio contra la tienda online en su fin de semana de más ventas, seguido de una extorsión. El equipo mantiene el pago abierto, usa a su proveedor de protección y habla con los clientes antes que los rumores.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Mantener abierto el pago
- **OBJ-02** Usar al proveedor
- **OBJ-03** Avisar a los clientes antes que los rumores

## Escenario

En vísperas del mayor fin de semana de ventas del año, un canal hacktivista incluye tu marca entre sus objetivos. A la mañana siguiente el tráfico de la tienda se dispara.

## Fases e injects

### PH-01 Aviso

Jueves, 18:00. Las ventas empiezan mañana a las 08:00.

- **INJ-01** (T+5′) Una lista de objetivos con tu nombre

### PH-02 Bajo ataque

Viernes, 08:20. El tráfico es cuarenta veces el normal y sigue subiendo.

- **INJ-02** (T+45′) El pago no responde
- **INJ-03** (T+65′) Dos opciones, ambas caras
- **INJ-04** (T+85′) ¿Están a salvo los datos de los clientes?
- **INJ-05** (contingente) «Les han hackeado y robado nuestras tarjetas»

### PH-03 Extorsión

Viernes, 15:00. La tienda funciona tras la mitigación; siguen llegando quejas.

- **INJ-06** (T+120′) Paga o mañana será el doble

## Actores simulados

- **ACT-01** Canal hacktivista
- **ACT-02** SOC
- **ACT-03** Proveedor de alojamiento y protección DDoS
- **ACT-04** Medios de comunicación
- **ACT-05** Cliente

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "DDoS hacktivista en plena campaña de ventas",
    "description": "Un grupo hacktivista anuncia y después lanza un ataque de denegación de servicio contra la tienda online en su fin de semana de más ventas, seguido de una extorsión. El equipo mantiene el pago abierto, usa a su proveedor de protección y habla con los clientes antes que los rumores."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
      "third_party_supply_chain",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Operaciones de seguridad",
      "Responsable de operaciones de seguridad",
      "Responsable del incidente",
      "Comercio electrónico",
      "Dirección de comercio electrónico",
      "Comunicación",
      "Dirección de comunicación",
      "Atención al cliente"
    ],
    "third_parties": [],
    "perimeter": "La tienda online, su alojamiento y protección DDoS, comunicación y atención al cliente.",
    "out_of_scope": "La ingeniería de red de la mitigación y cualquier contacto con los atacantes.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "FAROL AZUL",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Procedimiento DDoS nunca usado",
        "finding": "El procedimiento DDoS se escribió al firmar el contrato y nunca se ha activado.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Opciones poco claras con el proveedor",
        "finding": "Nadie sabe qué opciones de mitigación incluye el contrato ni cuánto cuestan al negocio.",
        "affected_capability": "third_party_supply_chain",
        "priority": "medium"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "La última vez los rumores fueron más rápidos",
        "finding": "En una caída anterior, las redes hablaron de robo de datos horas antes de cualquier comunicado.",
        "affected_capability": "internal_external_comms",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Mantener abierto el pago",
        "statement": "El pago vuelve a estar disponible en los 60 minutos siguientes al inicio del ataque, con la mitigación del proveedor activa.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Procedimiento DDoS activado\nMitigación del proveedor solicitada\nPago disponible en 60 minutos de tiempo de escenario",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Activación del procedimiento y ticket del proveedor, con sus horas.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Usar al proveedor",
        "statement": "El equipo contacta con el proveedor de protección por el canal contratado, compara las opciones de mitigación con su impacto en el negocio y decide.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Proveedor contactado por el canal contratado\nOpciones comparadas con su impacto en el negocio\nDecisión y responsable registrados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El ticket del proveedor y el registro de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Avisar a los clientes antes que los rumores",
        "statement": "En los 30 minutos siguientes a la primera pregunta de prensa o redes, se publica un mensaje de estado y atención al cliente usa el mismo texto.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Mensaje de estado publicado\nNinguna afirmación sobre robo de datos sin evidencias\nAtención al cliente informada con el mismo mensaje",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El mensaje de estado y la nota a atención al cliente.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "Fin de semana negro",
    "summary": "En vísperas del mayor fin de semana de ventas del año, un canal hacktivista incluye tu marca entre sus objetivos. A la mañana siguiente el tráfico de la tienda se dispara.",
    "attack_version": "19.2",
    "duration_minutes": 160,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Aviso",
        "start_offset": 0,
        "end_offset": 40,
        "incident_jump_minutes": 0,
        "situation_update": "Jueves, 18:00. Las ventas empiezan mañana a las 08:00.",
        "key_questions": [
          "¿Quién es responsable del procedimiento DDoS esta noche?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Tu marca está en una lista de objetivos"
      },
      {
        "code": "PH-02",
        "name": "Bajo ataque",
        "start_offset": 40,
        "end_offset": 110,
        "incident_jump_minutes": 840,
        "situation_update": "Viernes, 08:20. El tráfico es cuarenta veces el normal y sigue subiendo.",
        "key_questions": [
          "¿Qué mitigación nos cuesta menos ventas?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "El pago no responde"
      },
      {
        "code": "PH-03",
        "name": "Extorsión",
        "start_offset": 110,
        "end_offset": 160,
        "incident_jump_minutes": 300,
        "situation_update": "Viernes, 15:00. La tienda funciona tras la mitigación; siguen llegando quejas.",
        "key_questions": [
          "¿Qué decimos ahora a clientes y plantilla?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Paga o mañana será el doble"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Colectivo hacktivista",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Un grupo con motivación política que alquila capacidad de botnets para campañas de denegación de servicio.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1583.005"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1498"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1499"
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
        "title": "Una lista de objetivos con tu nombre",
        "content": "Mañana tumbamos las tiendas que se lucran mientras otros sufren. Adjuntamos la lista de objetivos. Tu marca es la tercera.",
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
          "Operaciones de seguridad",
          "Responsable del incidente"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0042",
            "technique_id": "T1583.005"
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
            "description": "El responsable del incidente confirma quién tiene el procedimiento DDoS y los contactos del proveedor para el fin de semana.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Canal hacktivista",
          "sender_address": "@op_blackweekend",
          "recipient": "",
          "subject": "",
          "timestamp": "Jueves 17:52",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "El pago no responde",
        "content": "Peticiones de capa de aplicación desde decenas de miles de direcciones golpean las páginas de búsqueda y pago. El pago no responde a la mayoría de clientes.",
        "offset_minutes": 45,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-02",
        "attack_attribution": "threat_actor",
        "threat_actor_code": "THR-01",
        "recipients": [
          "Operaciones de seguridad"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1499"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Operaciones de seguridad activa el procedimiento DDoS y pide la mitigación al proveedor.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Dos opciones, ambas caras",
        "content": "El proveedor ha absorbido la inundación volumétrica, pero el ataque de aplicación sigue. Opciones: una página de verificación para todos los visitantes (aproximadamente un tercio menos de conversiones) o bloquear regiones enteras donde viven algunos de tus clientes.",
        "offset_minutes": 65,
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
          "Dirección de comercio electrónico"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1498"
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
            "description": "La dirección de comercio electrónico compara las opciones con el proveedor y decide, registrando el responsable.",
            "responsible_role": "Dirección de comercio electrónico",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "¿Están a salvo los datos de los clientes?",
        "content": "Un periodista de consumo pregunta si la caída es un ciberataque y si se han robado datos de clientes.",
        "offset_minutes": 85,
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
          "Dirección de comunicación"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Comunicación publica un mensaje de estado y pasa el mismo texto a atención al cliente.",
            "responsible_role": "Dirección de comunicación",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "«Les han hackeado y robado nuestras tarjetas»",
        "content": "Tres horas intentando pagar. Un amigo de informática dice que les han hackeado y se han llevado nuestras tarjetas. Gracias por nada.",
        "offset_minutes": null,
        "trigger_condition": "Sin mensaje de estado 30 minutos después de INJ-04.",
        "contingent_purpose": "Dejar que el rumor llene el silencio.",
        "fires_at_minute": 60,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-05",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comunicación",
          "Atención al cliente"
        ],
        "delivery_method": "media",
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
            "description": "Comunicación corrige el rumor solo con hechos confirmados.",
            "responsible_role": "Dirección de comunicación",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "social_post",
          "sender": "Cliente enfadado",
          "sender_address": "@shopper_dani",
          "recipient": "",
          "subject": "",
          "timestamp": "Viernes 10:41",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Paga o mañana será el doble",
        "content": "Lo de hoy ha sido una prueba. Paga dos bitcoins antes de medianoche o el ataque de mañana será el doble. La dirección está abajo.",
        "offset_minutes": 120,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable del incidente"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "El responsable del incidente registra la postura ante la demanda, la protección prevista para mañana y la denuncia.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Comunicación actualiza el mensaje de estado y la nota interna para la plantilla.",
            "responsible_role": "Dirección de comunicación",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Op Black Weekend",
          "sender_address": "opbw@mail.example.net",
          "recipient": "Equipo de seguridad",
          "subject": "Mañana será peor",
          "timestamp": "Viernes 14:55",
          "location": ""
        }
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-01",
      "name": "Canal hacktivista",
      "type": "threat_actor",
      "description": "Publica listas de objetivos, alardes y la demanda de extorsión.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "cloud-provider",
      "origin_name": "Proveedor cloud",
      "code": "ACT-03",
      "name": "Proveedor de alojamiento y protección DDoS",
      "type": "supplier",
      "description": "Aloja la tienda y gestiona la mitigación DDoS contratada.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-04",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
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
      "origin_id": "ddos",
      "origin_name": "DDoS",
      "name": "DDoS",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "communications",
      "origin_name": "Comunicación",
      "name": "Comunicación",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "mixed",
      "origin_name": "Público mixto",
      "name": "Público mixto",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    }
  ],
  "images": [],
  "uses_rooms": false,
  "rooms": [],
  "next_room_number": 1,
  "files": []
}
```
