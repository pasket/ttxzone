---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Un ransomware paraliza a un fabricante y a su cadena de suministro"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Un ransomware paraliza a un fabricante y a su cadena de suministro

Un ransomware obliga a un fabricante con producción justo a tiempo a apagar sus sistemas y parar todas sus plantas. Los proveedores se quedan sin pedidos, los concesionarios no pueden pedir y los proveedores pequeños sufren una crisis de liquidez. El ejercicio pone a prueba las decisiones de parada y arranque, la comunicación con la cadena de suministro sin correo y quién habla de empleo y economía.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Parada y arranque controlados
- **OBJ-02** Cadena de suministro informada
- **OBJ-03** Autoridades y público informados

## Escenario

En el cambio de turno de las 06:00, {organization} detecta cifrado en los servidores que planifican la producción y la logística. Los sistemas de planta comparten la misma red.

## Fases e injects

### PH-01 Parada

Miércoles, cambio de turno de las 06:00. Cifrado en los servidores de planificación.

- **INJ-01** (T+5′) Cifrado en los servidores de planificación
- **INJ-02** (T+30′) ¿Puede seguir la planta 2?

### PH-02 Plantas paradas

Tres días después. Plantas paradas; proveedores y concesionarios esperan.

- **INJ-03** (T+55′) ¿Deben seguir produciendo los proveedores?
- **INJ-04** (T+80′) Los concesionarios no pueden pedir
- **INJ-05** (T+95′) Notificación del incidente a las 72 horas

### PH-03 Arranque

Dos semanas después. Los sistemas se están reconstruyendo; los proveedores pequeños pasan apuros.

- **INJ-06** (T+115′) Un proveedor pequeño se queda sin caja
- **INJ-07** (T+140′) ¿Listos para arrancar?
- **INJ-08** (T+155′) Empleo y economía

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Empleado
- **ACT-03** Proveedor crítico
- **ACT-04** Cliente
- **ACT-05** Autoridad competente
- **ACT-06** Proveedor de respuesta a incidentes (retainer)
- **ACT-07** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Un ransomware paraliza a un fabricante y a su cadena de suministro",
    "description": "Un ransomware obliga a un fabricante con producción justo a tiempo a apagar sus sistemas y parar todas sus plantas. Los proveedores se quedan sin pedidos, los concesionarios no pueden pedir y los proveedores pequeños sufren una crisis de liquidez. El ejercicio pone a prueba las decisiones de parada y arranque, la comunicación con la cadena de suministro sin correo y quién habla de empleo y economía."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "annual_program"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "continuity_recovery",
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
      "Fabricación",
      "Compras",
      "Ventas",
      "Comunicación",
      "Legal",
      "Presidencia del comité de crisis",
      "Dirección de fabricación",
      "Dirección de compras",
      "Dirección comercial",
      "Responsable de cumplimiento",
      "Dirección financiera",
      "Director de TI",
      "Responsable de comunicación",
      "Consejero delegado"
    ],
    "third_parties": [
      "Proveedores",
      "Concesionarios"
    ],
    "perimeter": "Las plantas, la planificación de producción y logística, proveedores y concesionarios, y el comité de crisis.",
    "out_of_scope": "La recuperación técnica de los sistemas de planta.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "IRON GATE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "risk_analysis",
        "title": "Los sistemas de planta comparten la red corporativa",
        "finding": "Planificación, logística y ejecución en planta comparten infraestructura; un incidente corporativo para la producción.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Sin canal con proveedores si cae el correo",
        "finding": "Miles de proveedores reciben los pedidos solo a través de sistemas que estarían caídos.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación de incidentes sin ensayar",
        "finding": "La notificación a la autoridad competente nunca se ha ensayado.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Parada y arranque controlados",
        "statement": "El comité decide el alcance de la parada y el orden de arranque, con criterios de validación.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Alcance de la parada decidido\nOrden de arranque y comprobaciones acordados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Actas del comité y plan de arranque.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Cadena de suministro informada",
        "statement": "Proveedores y concesionarios reciben instrucciones claras por un canal alternativo y se decide el apoyo a proveedores.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Instrucciones enviadas a proveedores y concesionarios\nApoyo a proveedores decidido",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Mensajes enviados y decisión de pago.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Autoridades y público informados",
        "statement": "Se notifica el incidente a la autoridad competente y una persona portavoz se dirige al Gobierno, los sindicatos y la prensa.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Notificación enviada\nPortavoz nombrado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Notificación y comunicado.",
        "regulatory_requirement_ids": [
          "NIS2-23"
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
    "title": "Todas las líneas paradas",
    "summary": "En el cambio de turno de las 06:00, {organization} detecta cifrado en los servidores que planifican la producción y la logística. Los sistemas de planta comparten la misma red.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Parada",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Miércoles, cambio de turno de las 06:00. Cifrado en los servidores de planificación.",
        "key_questions": [
          "¿Parar todas las plantas o intentar mantener alguna línea?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          }
        ],
        "headline": "Cifrado en el cambio de turno"
      },
      {
        "code": "PH-02",
        "name": "Plantas paradas",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 4320,
        "situation_update": "Tres días después. Plantas paradas; proveedores y concesionarios esperan.",
        "key_questions": [
          "¿Cómo llegamos a miles de proveedores sin correo?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "Proveedores y concesionarios a ciegas"
      },
      {
        "code": "PH-03",
        "name": "Arranque",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 20160,
        "situation_update": "Dos semanas después. Los sistemas se están reconstruyendo; los proveedores pequeños pasan apuros.",
        "key_questions": [
          "¿Qué arrancamos primero y cómo nos fiamos?"
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
            "due": true
          }
        ],
        "headline": "Reconstrucción y proveedores en apuros"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Afiliado de ransomware",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Afiliado de ransomware sin identificar.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "ics",
            "technique_id": "T0826"
          },
          {
            "domain": "ics",
            "technique_id": "T0828"
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
        "title": "Cifrado en los servidores de planificación",
        "content": "El SOC: se están cifrando ficheros en los servidores de planificación de producción y logística. Los sistemas de ejecución de las plantas están en el mismo dominio.",
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
          "Comité de crisis"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
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
            "description": "Decide si apaga todos los sistemas y para todas las plantas.",
            "responsible_role": "Presidencia del comité de crisis",
            "expected_within_minutes": 15,
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
        "title": "¿Puede seguir la planta 2?",
        "content": "El responsable de la planta 2: las líneas se paran con vehículos a medio montar. «Nuestros controladores de línea siguen funcionando. ¿Podemos aislar la planta y seguir?».",
        "offset_minutes": 30,
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
          "Dirección de fabricación",
          "Comité de crisis"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0828"
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
            "description": "Decide si alguna línea sigue funcionando y en qué condiciones.",
            "responsible_role": "Dirección de fabricación",
            "expected_within_minutes": 15,
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
        "title": "¿Deben seguir produciendo los proveedores?",
        "content": "Un proveedor de primer nivel: tres días sin pedidos, hay camiones esperando en vuestras puertas y sus líneas están llenas. ¿Siguen produciendo o paran?",
        "offset_minutes": 55,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección de compras"
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
            "description": "Envía instrucciones a los proveedores por un canal alternativo.",
            "responsible_role": "Dirección de compras",
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
        "title": "Los concesionarios no pueden pedir",
        "content": "La asociación de concesionarios: no pueden pedir vehículos ni recambios, ni tramitar matriculaciones. Los clientes están cancelando.",
        "offset_minutes": 80,
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
          "Dirección comercial"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "Da a los concesionarios un proceso manual y un contacto.",
            "responsible_role": "Dirección comercial",
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
        "origin": "system",
        "origin_id": "INJ-REG-03",
        "origin_name": "Notificación del incidente a las 72 horas",
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Notificación del incidente a las 72 horas",
        "content": "La autoridad competente recuerda a {organization} que vence la notificación del incidente y pide el impacto en la producción y en la cadena de suministro.",
        "offset_minutes": 95,
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
          "Responsable de cumplimiento",
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
            "description": "Envía la notificación con el impacto en la producción.",
            "responsible_role": "Responsable de cumplimiento",
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
        "title": "Un proveedor pequeño se queda sin caja",
        "content": "Un proveedor pequeño para el que sois el único gran cliente: sin cobrar en tres semanas, despedirá a parte de la plantilla la semana que viene. Pide que le paguéis las piezas que no ha podido entregar.",
        "offset_minutes": 115,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección financiera",
          "Dirección de compras"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Decide si paga a los proveedores las piezas no entregadas y quién lo autoriza.",
            "responsible_role": "Dirección financiera",
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "¿Listos para arrancar?",
        "content": "El proveedor de respuesta a incidentes: los servidores de planificación y logística están reconstruidos y limpios; los de planta y concesionarios aún se están revisando. Los datos de producción pueden estar desincronizados.",
        "offset_minutes": 140,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Comité de crisis",
          "Director de TI"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Acuerda el orden de arranque y las comprobaciones de validación.",
            "responsible_role": "Comité de crisis",
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
        "code": "INJ-08",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Empleo y economía",
        "content": "Un periodista económico: los sindicatos dicen que miles de empleos en los proveedores están en riesgo y el Gobierno pide cifras. ¿Quién va a hablar en nombre de {organization}?",
        "offset_minutes": 155,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": "ACT-07",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable de comunicación",
          "Comité de crisis"
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
            "code": "INJ-08-A1",
            "description": "Acuerda quién habla con el Gobierno, los sindicatos y la prensa.",
            "responsible_role": "Consejero delegado",
            "expected_within_minutes": 15,
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
    "next_inject_number": 9,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-01",
      "name": "SOC",
      "type": "soc",
      "description": "El centro de operaciones de seguridad: alertas, hallazgos y peticiones de decisión.",
      "channel": "ticket"
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
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-03",
      "name": "Proveedor crítico",
      "type": "supplier",
      "description": "Un proveedor del que depende el negocio, afectado o implicado en el incidente.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "customer",
      "origin_name": "Cliente",
      "code": "ACT-04",
      "name": "Cliente",
      "type": "customer",
      "description": "Un cliente que nota el impacto y pide explicaciones.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "competent-authority",
      "origin_name": "Autoridad competente",
      "code": "ACT-05",
      "name": "Autoridad competente",
      "type": "authority",
      "description": "La autoridad de ciberseguridad a la que la organización notifica los incidentes.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-06",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
    },
    {
      "origin": "system",
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-07",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    }
  ],
  "next_actor_number": 8,
  "tags": [
    {
      "origin": "system",
      "origin_id": "ransomware",
      "origin_name": "Ransomware",
      "name": "Ransomware",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
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
      "origin_id": "crisis-committee",
      "origin_name": "Comité de crisis",
      "name": "Comité de crisis",
      "color": "indigo",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
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
