---
format: "ttx-zone.scenario"
format_version: 1
language: "es"
title: "Ransomware con doble extorsión"
exported_at: "2026-10-12T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware con doble extorsión

Un grupo criminal cifra los sistemas principales del negocio y amenaza con publicar datos robados. El comité de crisis decide sobre contención, notificación y comunicación mientras el incidente se desarrolla a lo largo de tres días.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** El comité asume el mando
- **OBJ-02** Alerta temprana decidida
- **OBJ-03** Mensaje público coherente

## Escenario

Un lunes a primera hora el centro de soporte recibe llamadas por archivos que no se abren. En pocas horas las aplicaciones principales están cifradas, aparece una nota de rescate y los atacantes afirman tener datos de clientes.

## Fases e injects

### PH-01 Detección y escalado

Lunes, 07:40. Varios departamentos informan de archivos cifrados.

- **INJ-01** (T+5′) Avalancha de llamadas al soporte
- **INJ-02** (T+25′) La nota de rescate

### PH-02 Contención y notificación

Lunes, 13:00. Las copias de seguridad están parcialmente afectadas; los atacantes publican una muestra.

- **INJ-03** (T+60′) Copias parcialmente cifradas
- **INJ-04** (T+80′) ¿Hay que notificarlo?
- **INJ-05** (contingente) Llama el CSIRT

### PH-03 Presión pública

Miércoles. Un periodista pide declaraciones sobre los datos filtrados.

- **INJ-06** (T+120′) Llama un periodista

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Atacante (remitente)
- **ACT-03** CSIRT nacional
- **ACT-04** Asesoría legal externa
- **ACT-05** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 1,
  "language": "es",
  "exported_at": "2026-10-12T00:00:00Z",
  "exercise": {
    "name": "Ransomware con doble extorsión",
    "description": "Un grupo criminal cifra los sistemas principales del negocio y amenaza con publicar datos robados. El comité de crisis decide sobre contención, notificación y comunicación mientras el incidente se desarrolla a lo largo de tres días."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "internal_external_comms"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Operaciones de seguridad",
      "Comunicación",
      "Legal",
      "Responsable de cumplimiento",
      "Responsable de operaciones de seguridad",
      "Presidencia del comité de crisis",
      "Responsable del incidente",
      "Responsable de comunicación"
    ],
    "third_parties": [],
    "perimeter": "La TI corporativa, el comité de crisis y los equipos de comunicación y legal.",
    "out_of_scope": "La recuperación técnica de sistemas y la negociación con los atacantes.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "PUERTO ROJO",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Escalado lento al comité de crisis",
        "finding": "En el último incidente grave el comité se convocó cuatro horas después de la detección.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Obligación de alerta temprana sin probar",
        "finding": "La alerta temprana de 24 horas al CSIRT nacional nunca se ha ejercitado.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "risk_analysis",
        "title": "Sin declaración de espera para fugas",
        "finding": "No existe un mensaje preaprobado para una fuga pública de datos de clientes.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "El comité asume el mando",
        "statement": "El comité de crisis se convoca y asigna un responsable del incidente en 30 minutos desde la nota de rescate.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Comité convocado\nResponsable del incidente designado\nPrimera decisión de contención registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de llamadas, acta del comité y cronología de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Alerta temprana decidida",
        "statement": "El comité decide, con su justificación, si procede una alerta temprana al CSIRT nacional antes de que acabe el primer día.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Obligación de notificar evaluada\nDecisión y justificación documentadas",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Acta con la decisión y su justificación; el borrador de notificación si se hizo.",
        "regulatory_requirement_ids": [
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-03",
        "title": "Mensaje público coherente",
        "statement": "Comunicación emite una declaración de espera acordada con Legal antes de que la fuga se haga pública.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Declaración de espera redactada\nRevisión legal registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El borrador de la declaración de espera y el registro de su revisión legal.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra de parada."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 4
  },
  "msel": {
    "title": "Bloqueados un lunes",
    "summary": "Un lunes a primera hora el centro de soporte recibe llamadas por archivos que no se abren. En pocas horas las aplicaciones principales están cifradas, aparece una nota de rescate y los atacantes afirman tener datos de clientes.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Detección y escalado",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Lunes, 07:40. Varios departamentos informan de archivos cifrados.",
        "key_questions": [
          "¿Quién decide convocar el comité de crisis?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ]
      },
      {
        "code": "PH-02",
        "name": "Contención y notificación",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 240,
        "situation_update": "Lunes, 13:00. Las copias de seguridad están parcialmente afectadas; los atacantes publican una muestra.",
        "key_questions": [
          "¿Procede una alerta temprana y quién la envía?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": false
          },
          {
            "code": "OBJ-02",
            "due": true
          }
        ]
      },
      {
        "code": "PH-03",
        "name": "Presión pública",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 2880,
        "situation_update": "Miércoles. Un periodista pide declaraciones sobre los datos filtrados.",
        "key_questions": [
          "¿Qué decimos y a quién primero?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ]
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0102",
        "origin_name": "Wizard Spider",
        "code": "THR-01",
        "name": "Wizard Spider",
        "mitre_group_id": "G0102",
        "aliases": [],
        "description": "Grupo con motivación económica que opera ransomware con robo de datos.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1566.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021.001"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1490"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1567.002"
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
        "title": "Avalancha de llamadas al soporte",
        "content": "Doce tickets en diez minutos: las unidades compartidas muestran archivos con extensión .lck y los usuarios no pueden abrirlos.",
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
        "delivery_method": "ticket",
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
            "description": "Operaciones de seguridad lo clasifica como incidente grave y escala.",
            "responsible_role": "Responsable de operaciones de seguridad",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "La nota de rescate",
        "content": "Una nota en cada servidor cifrado exige el pago en 72 horas y afirma que se han robado 400 GB de datos de clientes.",
        "offset_minutes": 25,
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
          "Comité de crisis"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
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
            "code": "INJ-02-A1",
            "description": "Se convoca el comité de crisis y se designa un responsable del incidente.",
            "responsible_role": "Presidencia del comité de crisis",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Copias parcialmente cifradas",
        "content": "El equipo de infraestructura confirma que se borraron las copias recientes; solo la copia offline del mes pasado está intacta.",
        "offset_minutes": 60,
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
          "Comité de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1490"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "El comité decide qué aislar y registra la decisión.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "¿Hay que notificarlo?",
        "content": "Legal pregunta si el incidente alcanza el umbral de una alerta temprana y quién la enviaría.",
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
          "Comité de crisis"
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
            "description": "El comité decide sobre la alerta temprana y registra su justificación.",
            "responsible_role": "Responsable de cumplimiento",
            "expected_within_minutes": 20,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-05",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "Llama el CSIRT",
        "content": "El CSIRT nacional ha visto la muestra filtrada y pregunta si estáis afectados.",
        "offset_minutes": null,
        "trigger_condition": "Sin decisión sobre la alerta temprana 20 minutos después de INJ-04.",
        "contingent_purpose": "Volver a poner la obligación de notificar sobre la mesa.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-04",
        "branch_action_code": "INJ-04-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-03",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable de cumplimiento"
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
            "description": "El comité confirma la alerta temprana y quién la envía.",
            "responsible_role": "Responsable de cumplimiento",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Llama un periodista",
        "content": "Una periodista tiene una muestra de los registros filtrados y publicará en dos horas, con o sin vuestra declaración.",
        "offset_minutes": 120,
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
          "Comunicación"
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
            "code": "INJ-06-A1",
            "description": "Comunicación redacta una declaración de espera y Legal la revisa.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 30,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": []
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
      "origin_id": "threat-actor",
      "origin_name": "Atacante (remitente)",
      "code": "ACT-02",
      "name": "Atacante (remitente)",
      "type": "threat_actor",
      "description": "Firma los mensajes del atacante: notas de rescate, publicaciones de filtraciones, plazos. Quién es el atacante, y sus técnicas, son los actores de amenaza del escenario.",
      "channel": "document"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-03",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
      "channel": "email"
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
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-05",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    }
  ],
  "next_actor_number": 6,
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
  "images": []
}
```
