---
format: "ttx-zone.scenario"
format_version: 5
language: "es"
title: "Fraude de factura de proveedor"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Fraude de factura de proveedor

Un mensaje que parece de un proveedor de siempre pide cambiar sus datos bancarios. El pago sale y tres días después llama el proveedor real. El equipo corta la hemorragia, intenta recuperar el dinero y trabaja con el proveedor.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Detectar y frenar el cambio
- **OBJ-02** Recuperar el pago
- **OBJ-03** Trabajar con el proveedor

## Escenario

Un mensaje en un hilo de correo ya existente con el proveedor de embalajes anuncia nuevos datos bancarios para su próxima factura, que vence esta semana.

## Fases e injects

### PH-01 La petición

Lunes, 09:00. Cuentas a pagar revisa las facturas de la semana.

- **INJ-01** (T+5′) Datos bancarios actualizados
- **INJ-02** (T+25′) Urgente: por favor pagad hoy

### PH-02 El dinero ya no está

Jueves, 10:00. El proveedor real pregunta por qué no ha cobrado.

- **INJ-03** (T+60′) Nunca nos pagasteis
- **INJ-04** (T+80′) Una regla de reenvío en nuestro buzón
- **INJ-05** (contingente) Los fondos ya se han movido

### PH-03 El lado del proveedor

Jueves, 14:00. La informática del proveedor ha encontrado algo.

- **INJ-06** (T+120′) Empezó en nuestra casa

## Actores simulados

- **ACT-01** Proveedor (suplantado)
- **ACT-02** Proveedor de embalajes
- **ACT-03** SOC
- **ACT-04** Banco de la organización
- **ACT-05** Unidad de delitos informáticos

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Fraude de factura de proveedor",
    "description": "Un mensaje que parece de un proveedor de siempre pide cambiar sus datos bancarios. El pago sale y tres días después llama el proveedor real. El equipo corta la hemorragia, intenta recuperar el dinero y trabaja con el proveedor."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "audit_finding"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "legal_forensics",
      "third_party_supply_chain"
    ],
    "levels": [
      "tactical",
      "operational"
    ],
    "participating_areas": [
      "Finanzas",
      "Responsable de finanzas",
      "Operaciones de seguridad",
      "Responsable de operaciones de seguridad",
      "Responsable del incidente",
      "Legal",
      "Compras"
    ],
    "third_parties": [],
    "perimeter": "Cuentas a pagar, el correo corporativo, la relación con el banco y el proveedor.",
    "out_of_scope": "Medidas disciplinarias y la investigación interna del banco.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "MUELLE PLATA",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Datos bancarios cambiados por correo",
        "finding": "Una auditoría detectó cambios de datos bancarios aceptados solo por correo, sin llamada de verificación.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Retirada lenta la última vez",
        "finding": "Un pago fraudulento anterior se comunicó al banco al día siguiente y no pudo recuperarse.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "threat_intel",
        "title": "Proveedores como eslabón débil",
        "finding": "Varias empresas del sector informaron de fraudes que empezaron en el buzón comprometido de un proveedor.",
        "affected_capability": "third_party_supply_chain",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Detectar y frenar el cambio",
        "statement": "Cuentas a pagar verifica cualquier cambio de datos bancarios por un teléfono conocido y comunica los mensajes sospechosos a seguridad, que acota el compromiso del buzón.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Cambio verificado por un teléfono conocido\nMensajes sospechosos comunicados a seguridad\nCompromiso del buzón acotado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de la llamada, el aviso a seguridad y los hallazgos del buzón.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Recuperar el pago",
        "statement": "En las dos horas siguientes a descubrir el fraude, se pide al banco la retrocesión, se preservan las evidencias y se decide la denuncia.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Retrocesión solicitada al banco\nMensajes preservados como evidencia\nDenuncia decidida",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La solicitud de retrocesión, los mensajes preservados y el registro de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Trabajar con el proveedor",
        "statement": "El equipo contacta con el proveedor por un canal conocido, intercambia indicadores y acuerda cómo avisar a otros clientes.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Proveedor contactado por un canal conocido\nIndicadores intercambiados\nAviso a otros clientes acordado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de la llamada y los indicadores compartidos.",
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
    "title": "Nuevos datos bancarios",
    "summary": "Un mensaje en un hilo de correo ya existente con el proveedor de embalajes anuncia nuevos datos bancarios para su próxima factura, que vence esta semana.",
    "attack_version": "19.2",
    "duration_minutes": 160,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "La petición",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Lunes, 09:00. Cuentas a pagar revisa las facturas de la semana.",
        "key_questions": [
          "¿Cómo verificamos un cambio de datos bancarios?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Nuevos datos bancarios, mismo hilo"
      },
      {
        "code": "PH-02",
        "name": "El dinero ya no está",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Jueves, 10:00. El proveedor real pregunta por qué no ha cobrado.",
        "key_questions": [
          "¿Quién llama al banco y con qué rapidez?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Llama el proveedor real"
      },
      {
        "code": "PH-03",
        "name": "El lado del proveedor",
        "start_offset": 110,
        "end_offset": 160,
        "incident_jump_minutes": 180,
        "situation_update": "Jueves, 14:00. La informática del proveedor ha encontrado algo.",
        "key_questions": [
          "¿Qué compartimos y con quién?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Empezó en su buzón"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Banda de fraude de facturas",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Un grupo criminal que toma buzones y suplanta a proveedores para desviar pagos.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1114.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1534"
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
        "title": "Datos bancarios actualizados",
        "content": "Hola, con motivo de nuestro cambio de banco, utilizad por favor la cuenta de abajo para la factura 2291 y todos los pagos futuros. La cuenta antigua se cerrará a final de semana. Un saludo.",
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
          "Finanzas"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1566.002"
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
            "description": "Cuentas a pagar verifica el cambio llamando al proveedor al teléfono que consta en el maestro.",
            "responsible_role": "Responsable de finanzas",
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
          "kind": "email",
          "sender": "Administración, proveedor de embalajes",
          "sender_address": "accounts@packaging-suppiler.example",
          "recipient": "Cuentas a pagar",
          "subject": "RE: Factura 2291 — datos bancarios actualizados",
          "timestamp": "Lunes 08:47",
          "location": ""
        }
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Urgente: por favor pagad hoy",
        "content": "Un segundo mensaje en el mismo hilo insiste en que el pago está vencido y que la producción se parará si la factura no se paga hoy a la cuenta nueva.",
        "offset_minutes": 25,
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
          "Finanzas"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1534"
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
            "description": "Finanzas comunica los mensajes a seguridad antes de pagar nada.",
            "responsible_role": "Responsable de finanzas",
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
        "title": "Nunca nos pagasteis",
        "content": "El proveedor real llama por la factura 2291: 248.000 euros, ya vencida. Vuestro sistema la muestra pagada el lunes, a la cuenta nueva.",
        "offset_minutes": 60,
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
          "Responsable de finanzas"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Finanzas pide al banco la retrocesión de inmediato y preserva los mensajes.",
            "responsible_role": "Responsable de finanzas",
            "expected_within_minutes": 15,
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
        "title": "Una regla de reenvío en nuestro buzón",
        "content": "Seguridad encuentra en el buzón de un administrativo de cuentas a pagar una regla que reenvía y oculta todos los mensajes del proveedor, e inicios de sesión desde un país desconocido la semana pasada.",
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
          "Operaciones de seguridad"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0009",
            "technique_id": "T1114.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Operaciones de seguridad restablece las credenciales, elimina la regla y revisa los demás buzones de finanzas.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 20,
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
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "Los fondos ya se han movido",
        "content": "El banco dice que la mayor parte del dinero salió ayer de la cuenta receptora hacia otros dos bancos en el extranjero; aún es posible pedir la retrocesión de lo que queda si se solicita ya.",
        "offset_minutes": null,
        "trigger_condition": "Sin solicitud de retrocesión 15 minutos después de INJ-03.",
        "contingent_purpose": "Mostrar lo rápido que se cierra la ventana.",
        "fires_at_minute": 40,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-04",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable de finanzas",
          "Responsable del incidente"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "El responsable del incidente consigue que se pida la retrocesión y se presente la denuncia hoy.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 10,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Empezó en nuestra casa",
        "content": "La informática del proveedor confirma que uno de sus buzones fue tomado hace un mes; los atacantes escribieron a varios de sus clientes. Pide coordinarse.",
        "offset_minutes": 120,
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
          "Compras",
          "Responsable del incidente"
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
            "description": "El responsable del incidente acuerda con el proveedor los indicadores a intercambiar y un aviso conjunto a sus otros clientes.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null
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
      "name": "Proveedor (suplantado)",
      "type": "threat_actor",
      "description": "Escribe como el proveedor desde una dirección parecida.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-02",
      "name": "Proveedor de embalajes",
      "type": "supplier",
      "description": "El proveedor real: de siempre, factura mensualmente.",
      "channel": "phone"
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
      "origin_id": "bank",
      "origin_name": "Banco de la organización",
      "code": "ACT-04",
      "name": "Banco de la organización",
      "type": "other",
      "description": "La entidad bancaria: transferencias sospechosas, retención de fondos y plazos para recuperarlos.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "police-cybercrime",
      "origin_name": "Unidad de delitos informáticos",
      "code": "ACT-05",
      "name": "Unidad de delitos informáticos",
      "type": "authority",
      "description": "Las fuerzas de seguridad que investigan el ataque y piden evidencias.",
      "channel": "phone"
    }
  ],
  "next_actor_number": 6,
  "tags": [
    {
      "origin": "system",
      "origin_id": "bec",
      "origin_name": "BEC / Fraude del CEO",
      "name": "BEC / Fraude del CEO",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "legal-compliance",
      "origin_name": "Legal y cumplimiento",
      "name": "Legal y cumplimiento",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "supplier",
      "origin_name": "Proveedor",
      "name": "Proveedor",
      "color": "sand",
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
