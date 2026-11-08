---
format: "ttx-zone.scenario"
format_version: 5
language: "es"
title: "Datos de clientes en un almacenamiento abierto"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Datos de clientes en un almacenamiento abierto

Un investigador de seguridad avisa de que un contenedor de almacenamiento cloud con exportaciones de clientes lleva semanas legible públicamente. El equipo lo cierra, averigua qué se expuso y decide la notificación a la autoridad y a los clientes.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Decidir la notificación de 72 horas
- **OBJ-02** Cerrar y acotar la exposición
- **OBJ-03** Un mensaje coherente con los hechos

## Escenario

Un mensaje de un investigador independiente dice que un contenedor llamado exports-prod muestra ficheros de clientes a cualquiera en internet. Llegó por el contacto de seguridad de la web.

## Fases e injects

### PH-01 El aviso

Martes, 11:00. El buzón de seguridad tiene un mensaje de un investigador.

- **INJ-01** (T+5′) Un contenedor que cualquiera puede leer
- **INJ-02** (T+25′) Abierto 47 días

### PH-02 ¿Lo descargó alguien?

Martes, 15:00. Ya están los registros; el delegado de protección de datos se ha unido.

- **INJ-03** (T+60′) Catorce descargas
- **INJ-04** (T+80′) ¿Avisar a 3,2 millones de clientes?
- **INJ-05** (contingente) El investigador publica un adelanto

### PH-03 Hacerlo público

Miércoles, 11:00. Veinticuatro horas desde el aviso.

- **INJ-06** (T+120′) Un periodista tiene una muestra

## Actores simulados

- **ACT-01** Investigador de seguridad
- **ACT-02** Equipo de seguridad cloud
- **ACT-03** Asesoría legal externa
- **ACT-04** Medios de comunicación
- **ACT-05** Autoridad de protección de datos

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Datos de clientes en un almacenamiento abierto",
    "description": "Un investigador de seguridad avisa de que un contenedor de almacenamiento cloud con exportaciones de clientes lleva semanas legible públicamente. El equipo lo cierra, averigua qué se expuso y decide la notificación a la autoridad y a los clientes."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "org_or_tech_change"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "regulatory_notification",
      "incident_classification",
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
      "Equipo de plataforma cloud",
      "Delegado de protección de datos",
      "Legal",
      "Comunicación",
      "Dirección de comunicación"
    ],
    "third_parties": [],
    "perimeter": "El almacenamiento cloud, el proceso de protección de datos y la comunicación externa.",
    "out_of_scope": "El rediseño de la arquitectura cloud y cualquier respuesta al investigador sobre recompensas.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "PINO BLANCO",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "Evaluación de brechas nunca ensayada",
        "finding": "El delegado de protección de datos nunca ha dirigido una evaluación de brecha contra el reloj de 72 horas.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "recent_changes",
        "title": "La migración dejó cabos sueltos",
        "finding": "El paso a la nueva plataforma cloud cambió permisos de almacenamiento sin revisión.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "incident_history",
        "title": "Cifras cambiadas tras publicarlas",
        "finding": "En un incidente anterior se publicó el número de clientes afectados y luego se corrigió dos veces.",
        "affected_capability": "internal_external_comms",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decidir la notificación de 72 horas",
        "statement": "Confirmada la exposición, el delegado de protección de datos dirige una evaluación de riesgo documentada y el equipo decide, con motivos, la notificación a la autoridad en 72 horas y la comunicación a los clientes.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Delegado de protección de datos implicado\nRiesgo para las personas afectadas evaluado y registrado\nDecisión sobre notificar a la autoridad registrada con sus motivos\nDecisión sobre informar a los clientes registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La evaluación de la brecha, la entrada en el registro y el borrador de notificación.",
        "regulatory_requirement_ids": [
          "GDPR-33-34"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Cerrar y acotar la exposición",
        "statement": "En la hora siguiente al aviso, se retira el acceso público y el equipo establece qué se expuso, desde cuándo y qué muestran los registros de acceso.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Acceso público retirado\nPeriodo y registros expuestos establecidos\nGravedad asignada con sus criterios",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro del cambio y las notas de alcance.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Un mensaje coherente con los hechos",
        "statement": "Antes de hacer pública ninguna cifra, comunicación redacta un comunicado de espera revisado por Legal y el delegado de protección de datos.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Comunicado de espera redactado\nRevisado por Legal y el delegado de protección de datos\nNinguna cifra que el equipo no haya confirmado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El comunicado y su rastro de revisión.",
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
    "title": "exports-prod",
    "summary": "Un mensaje de un investigador independiente dice que un contenedor llamado exports-prod muestra ficheros de clientes a cualquiera en internet. Llegó por el contacto de seguridad de la web.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "El aviso",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Martes, 11:00. El buzón de seguridad tiene un mensaje de un investigador.",
        "key_questions": [
          "¿Quién puede cerrarlo ya y qué conservamos antes de cerrar?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Un investigador encontró nuestro contenedor"
      },
      {
        "code": "PH-02",
        "name": "¿Lo descargó alguien?",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 240,
        "situation_update": "Martes, 15:00. Ya están los registros; el delegado de protección de datos se ha unido.",
        "key_questions": [
          "¿Corre el reloj de 72 horas y desde cuándo?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Catorce descargas que no sabemos explicar"
      },
      {
        "code": "PH-03",
        "name": "Hacerlo público",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1200,
        "situation_update": "Miércoles, 11:00. Veinticuatro horas desde el aviso.",
        "key_questions": [
          "¿Qué podemos decir que no cambie mañana?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Un periodista tiene una muestra"
      }
    ],
    "threat_actors": [],
    "injects": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Un contenedor que cualquiera puede leer",
        "content": "Buscando almacenamiento mal configurado he encontrado un contenedor llamado exports-prod que muestra ficheros CSV con nombres, correos y direcciones postales de clientes. No lo he compartido. Pienso publicar un artículo dentro de siete días.",
        "offset_minutes": 5,
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
          "Operaciones de seguridad",
          "Responsable del incidente"
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
            "code": "INJ-01-A1",
            "description": "El responsable del incidente abre un incidente y hace retirar el acceso público tras conservar la configuración y los registros.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Investigador independiente",
          "sender_address": "disclosure@researcher.example.org",
          "recipient": "Contacto de seguridad",
          "subject": "Contenedor listable públicamente con datos de clientes",
          "timestamp": "Martes 10:52",
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
        "title": "Abierto 47 días",
        "content": "El contenedor quedó público durante la migración hace 47 días. Contiene 3,2 millones de filas de exportaciones de clientes. Los registros de acceso solo se guardan 30 días.",
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
          "Equipo de plataforma cloud"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Operaciones de seguridad indica qué se expuso, desde cuándo y qué pueden mostrar los registros y qué no, y se asigna la gravedad.",
            "responsible_role": "Responsable de operaciones de seguridad",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Catorce descargas",
        "content": "En los 30 días de registros, el conjunto completo de ficheros se descargó catorce veces desde direcciones que no son de la empresa ni del investigador.",
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
          "Delegado de protección de datos"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "El delegado de protección de datos evalúa el riesgo para las personas afectadas y lo registra.",
            "responsible_role": "Delegado de protección de datos",
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
        "code": "INJ-04",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "¿Avisar a 3,2 millones de clientes?",
        "content": "La asesoría externa pide una decisión hoy: notificar a la autoridad, informar a cada cliente o ambas cosas, y detalla el coste de un envío masivo y un centro de llamadas dedicado.",
        "offset_minutes": 80,
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
          "Delegado de protección de datos",
          "Legal"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-04-A1",
            "description": "El delegado de protección de datos y Legal registran las decisiones sobre notificar a la autoridad e informar a los clientes, con sus motivos.",
            "responsible_role": "Delegado de protección de datos",
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
        "title": "El investigador publica un adelanto",
        "content": "Gran comercio, millones de registros de clientes, abiertos de par en par durante semanas. Divulgación responsable en curso; artículo la semana que viene.",
        "offset_minutes": null,
        "trigger_condition": "Sin evaluación de riesgo 20 minutos después de INJ-03.",
        "contingent_purpose": "Añadir presión externa para decidir.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Responsable del incidente",
          "Comunicación"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-05-A1",
            "description": "El responsable del incidente se asegura de que la evaluación de riesgo y la decisión de notificar se hagan hoy.",
            "responsible_role": "Responsable del incidente",
            "expected_within_minutes": 10,
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
          "sender": "Investigador independiente",
          "sender_address": "@open_buckets",
          "recipient": "",
          "subject": "",
          "timestamp": "Martes 16:20",
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
        "title": "Un periodista tiene una muestra",
        "content": "Un periodista tiene cincuenta filas de los ficheros, ha llamado a dos de los clientes que aparecen y publicará esta tarde.",
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
            "code": "INJ-06-A1",
            "description": "Comunicación redacta un comunicado de espera revisado por Legal y el delegado de protección de datos.",
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
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 7,
    "next_threat_actor_number": 1
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "security-researcher",
      "origin_name": "Investigador de seguridad",
      "code": "ACT-01",
      "name": "Investigador de seguridad",
      "type": "other",
      "description": "Un investigador externo que comunica una vulnerabilidad o una exposición, a veces pidiendo recompensa.",
      "channel": "email"
    },
    {
      "origin": "system",
      "origin_id": "soc",
      "origin_name": "SOC",
      "code": "ACT-02",
      "name": "Equipo de seguridad cloud",
      "type": "soc",
      "description": "Revisa la configuración y los registros de acceso del contenedor.",
      "channel": "ticket"
    },
    {
      "origin": "system",
      "origin_id": "external-counsel",
      "origin_name": "Asesoría legal externa",
      "code": "ACT-03",
      "name": "Asesoría legal externa",
      "type": "other",
      "description": "Abogados externos que asesoran sobre notificaciones, responsabilidad y comunicación.",
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
      "origin_id": "data-protection-authority",
      "origin_name": "Autoridad de protección de datos",
      "code": "ACT-05",
      "name": "Autoridad de protección de datos",
      "type": "authority",
      "description": "La autoridad de control ante brechas de datos personales.",
      "channel": "email"
    }
  ],
  "next_actor_number": 6,
  "tags": [
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
      "origin_id": "cloud",
      "origin_name": "Cloud",
      "name": "Cloud",
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
  "next_room_number": 1,
  "files": []
}
```
