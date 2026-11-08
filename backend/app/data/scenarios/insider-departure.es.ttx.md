---
format: "ttx-zone.scenario"
format_version: 5
language: "es"
title: "Un ingeniero que se va se lleva las joyas de la corona"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Un ingeniero que se va se lleva las joyas de la corona

Un ingeniero que acaba de dimitir para irse a la competencia copia ficheros de diseño y precios de clientes. Seguridad, RR. HH. y Legal deben actuar juntos sin alertarle ni perder las evidencias.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Escalar la alerta de fuga de datos
- **OBJ-02** Evidencias que se sostienen
- **OBJ-03** Un único plan para RR. HH., Legal y Seguridad

## Escenario

Una alerta de fuga de datos señala a un ingeniero que sincroniza gigabytes con su nube personal de madrugada. RR. HH. confirma que dimitió la semana pasada para irse a la competencia y se va el viernes.

## Fases e injects

### PH-01 Descarga inusual

Martes, 08:30. Las alertas nocturnas de fuga de datos esperan en la cola.

- **INJ-01** (T+5′) Alerta de fuga: 18 GB a nube personal
- **INJ-02** (T+25′) Dimitió la semana pasada

### PH-02 Investigación discreta

Miércoles, 10:00. El proveedor forense ha revisado en remoto la actividad del portátil.

- **INJ-03** (T+60′) También una copia a USB
- **INJ-04** (T+80′) Que se vaya ya
- **INJ-05** (contingente) El portátil se apaga

### PH-03 Consecuencias

Viernes. El ingeniero se ha ido; un cliente llama por una oferta de la competencia.

- **INJ-06** (T+120′) Un cliente reconoce sus precios

## Actores simulados

- **ACT-01** SOC
- **ACT-02** HR business partner
- **ACT-03** Proveedor de respuesta a incidentes (retainer)
- **ACT-04** Cliente
- **ACT-05** Unidad de delitos informáticos

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Un ingeniero que se va se lleva las joyas de la corona",
    "description": "Un ingeniero que acaba de dimitir para irse a la competencia copia ficheros de diseño y precios de clientes. Seguridad, RR. HH. y Legal deben actuar juntos sin alertarle ni perder las evidencias."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "new_threat",
      "pending_aar_actions"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [],
    "regulatory_framework_other": "",
    "capabilities": [
      "detection_triage_escalation",
      "legal_forensics",
      "cross_unit_coordination"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Operaciones de seguridad",
      "Responsable de operaciones de seguridad",
      "Responsable del incidente",
      "Recursos humanos",
      "Legal",
      "Asesoría jurídica interna",
      "Dirección de ingeniería"
    ],
    "third_parties": [],
    "perimeter": "Equipos y almacenamiento cloud corporativos, el proceso de bajas de RR. HH. y la respuesta legal.",
    "out_of_scope": "Decisiones disciplinarias sobre personas reales y el análisis forense técnico en sí.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "GARZA GRIS",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Sin vigilancia del movimiento de datos de quien se va",
        "finding": "Las alertas de fuga de datos no se cruzan con la lista de personas que han dimitido.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "incident_history",
        "title": "Evidencias perdidas en un caso anterior de RR. HH.",
        "finding": "Se reinstaló un portátil antes de que Legal lo pidiera y se abandonó una reclamación contra un ex empleado.",
        "affected_capability": "legal_forensics",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "previous_aar",
        "title": "RR. HH. y Seguridad actúan por separado",
        "finding": "El último ejercicio detectó que RR. HH. retira accesos a su ritmo, sin avisar a Seguridad.",
        "affected_capability": "cross_unit_coordination",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Escalar la alerta de fuga de datos",
        "statement": "En los 30 minutos siguientes a la alerta, operaciones de seguridad la vincula al usuario, abre un incidente y la escala al responsable del incidente.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Alerta vinculada a un usuario identificado\nRegistro de incidente abierto\nResponsable del incidente informado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro del incidente y el mensaje de escalado, con sus horas de escenario.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Evidencias que se sostienen",
        "statement": "Antes de hablar con el ingeniero, se preservan los dispositivos y cuentas implicados con cadena de custodia y se registra la decisión sobre denunciar a la policía.",
        "capability": "legal_forensics",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Imágenes de los dispositivos pedidas antes de la conversación\nRegistro de cadena de custodia iniciado\nDecisión sobre la denuncia registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de cadena de custodia y el registro de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Un único plan para RR. HH., Legal y Seguridad",
        "statement": "RR. HH., Legal y Seguridad acuerdan una única secuencia para retirar accesos, la reunión de salida y la recuperación de dispositivos, cada paso con un responsable.",
        "capability": "cross_unit_coordination",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Reunión conjunta celebrada\nSecuencia de acciones acordada\nResponsable designado para cada acción",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El plan acordado y sus responsables.",
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
    "title": "El viernes es su último día",
    "summary": "Una alerta de fuga de datos señala a un ingeniero que sincroniza gigabytes con su nube personal de madrugada. RR. HH. confirma que dimitió la semana pasada para irse a la competencia y se va el viernes.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Descarga inusual",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Martes, 08:30. Las alertas nocturnas de fuga de datos esperan en la cola.",
        "key_questions": [
          "¿Quién debe saberlo antes de que nadie hable con el empleado?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": false
          }
        ],
        "headline": "18 GB salen de un portátil a medianoche"
      },
      {
        "code": "PH-02",
        "name": "Investigación discreta",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 1440,
        "situation_update": "Miércoles, 10:00. El proveedor forense ha revisado en remoto la actividad del portátil.",
        "key_questions": [
          "¿Qué hay que preservar antes de retirar el acceso?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": false
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Una copia a USB y un director con prisa"
      },
      {
        "code": "PH-03",
        "name": "Consecuencias",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Viernes. El ingeniero se ha ido; un cliente llama por una oferta de la competencia.",
        "key_questions": [
          "¿Lo denunciamos a la policía y quién decide?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Un cliente reconoce sus precios"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Empleado saliente",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Una persona interna con acceso legítimo que copia datos antes de irse.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1213"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1052.001"
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
        "title": "Alerta de fuga: 18 GB a nube personal",
        "content": "Entre las 23:40 y la 01:15, un portátil asignado a un ingeniero de diseño sénior sincronizó 18 GB del repositorio de diseño de producto con una cuenta personal de almacenamiento cloud.",
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
          "Operaciones de seguridad"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1567.002"
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
            "description": "Operaciones de seguridad vincula la alerta al usuario, abre un incidente y la escala.",
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
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Dimitió la semana pasada",
        "content": "RR. HH. confirma que el ingeniero dimitió el lunes pasado para unirse a un competidor directo. Su último día es el viernes y, por defecto, mantiene todos sus accesos hasta entonces.",
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
            "code": "INJ-02-A1",
            "description": "El responsable del incidente reúne a RR. HH., Legal y Seguridad antes de que nadie contacte con el empleado.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "El responsable del incidente registra el escalado y a quién se informó.",
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
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "También una copia a USB",
        "content": "El proveedor forense informa de una memoria USB conectada el lunes por la tarde; los nombres de fichero coinciden con el repositorio de diseño y una hoja de precios de clientes. El portátil vuelve a TI el viernes para reinstalarlo.",
        "offset_minutes": 60,
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
          "Legal"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1052.001"
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
            "description": "Legal pide preservar el portátil y las cuentas, con cadena de custodia, antes de reinstalar nada.",
            "responsible_role": "Asesoría jurídica interna",
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
        "title": "Que se vaya ya",
        "content": "La directora de ingeniería quiere retirarle los accesos esta mañana y acompañarle fuera del edificio hoy mismo, delante del equipo.",
        "offset_minutes": 80,
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
          "Responsable del incidente",
          "Dirección de ingeniería"
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
            "description": "RR. HH., Legal y Seguridad acuerdan la secuencia: preservar, retirar accesos, reunión de salida y recuperación de dispositivos, cada paso con responsable.",
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
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "El portátil se apaga",
        "content": "Alguien se lo ha dicho. El portátil desaparece de la red; la última telemetría muestra el arranque de una utilidad de borrado de disco.",
        "offset_minutes": null,
        "trigger_condition": "Sin secuencia acordada 20 minutos después de INJ-04.",
        "contingent_purpose": "Mostrar qué pasa cuando cada equipo actúa por su cuenta.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Operaciones de seguridad",
          "Responsable del incidente"
        ],
        "delivery_method": "security_tool",
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
            "description": "El responsable del incidente detiene las acciones en paralelo y fija un único plan con responsables.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 10,
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Un cliente reconoce sus precios",
        "content": "Un cliente de toda la vida reenvía una oferta de la competencia que rebaja tus precios confidenciales exactamente un dos por ciento en cada línea, y pregunta qué está pasando.",
        "offset_minutes": 120,
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
          "Dirección de ingeniería",
          "Legal"
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
            "description": "Legal y el responsable del incidente deciden sobre la denuncia y las acciones civiles, y lo registran.",
            "responsible_role": "Asesoría jurídica interna",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-02"
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
      "name": "HR business partner",
      "type": "internal",
      "description": "La persona de RR. HH. que atiende a ingeniería: conoce las fechas de la baja y el proceso de salida.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "dfir-provider",
      "origin_name": "Proveedor de respuesta a incidentes (retainer)",
      "code": "ACT-03",
      "name": "Proveedor de respuesta a incidentes (retainer)",
      "type": "supplier",
      "description": "El equipo externo de respuesta y forense, normalmente con un contrato (retainer) que se activa durante el incidente: hallazgos, informes y recomendaciones de contención.",
      "channel": "briefing"
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
      "origin_id": "insider",
      "origin_name": "Amenaza interna",
      "name": "Amenaza interna",
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
