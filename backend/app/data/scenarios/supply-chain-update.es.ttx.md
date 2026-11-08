---
format: "ttx-zone.scenario"
format_version: 5
language: "es"
title: "Una actualización de software envenenada"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Una actualización de software envenenada

El agente de monitorización de un proveedor de confianza distribuye una actualización firmada pero troyanizada a cientos de servidores. El equipo acota la exposición, trabaja con el proveedor y decide la alerta temprana a la autoridad.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Trabajar con el proveedor
- **OBJ-02** Saber hasta dónde ha llegado
- **OBJ-03** Alerta temprana a tiempo

## Escenario

Un proveedor de inteligencia avisa de que la versión 4.2.1 de un agente de monitorización muy extendido, distribuida automáticamente la semana pasada, contiene una puerta trasera. Tus servidores se actualizaron según lo previsto.

## Fases e injects

### PH-01 Aviso

Jueves, 09:10. Llega un aviso al buzón de seguridad.

- **INJ-01** (T+5′) Aviso: puerta trasera en el agente 4.2.1
- **INJ-02** (T+25′) 312 servidores, 4 hablando hacia fuera

### PH-02 El proveedor y el corte

Jueves, 15:00. El proveedor confirma la brecha pero aún no tiene corrección.

- **INJ-03** (T+60′) El proveedor devuelve la llamada
- **INJ-04** (T+80′) ¿Desinstalarlo en todas partes?
- **INJ-05** (contingente) Había credenciales en el agente

### PH-03 Notificación

Viernes, 07:00. Veintidós horas desde el aviso.

- **INJ-06** (T+120′) El boletín del CSIRT

## Actores simulados

- **ACT-01** Proveedor de inteligencia de amenazas
- **ACT-02** SOC
- **ACT-03** Proveedor del software de monitorización
- **ACT-04** Responsable de infraestructura
- **ACT-05** CSIRT nacional

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 5,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Una actualización de software envenenada",
    "description": "El agente de monitorización de un proveedor de confianza distribuye una actualización firmada pero troyanizada a cientos de servidores. El equipo acota la exposición, trabaja con el proveedor y decide la alerta temprana a la autoridad."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "regulatory",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "third_party_supply_chain",
      "incident_classification",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Operaciones de seguridad",
      "Responsable de operaciones de seguridad",
      "Responsable del incidente",
      "Gestión de proveedores",
      "Gestor del proveedor",
      "Responsable de cumplimiento",
      "Infraestructura"
    ],
    "third_parties": [],
    "perimeter": "Servidores con el agente del proveedor, la gestión de proveedores y la notificación regulatoria.",
    "out_of_scope": "La ingeniería inversa del malware y la investigación interna del proveedor.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "MILANO COBRE",
    "needs": [
      {
        "code": "NEED-01",
        "source": "threat_intel",
        "title": "Sin procedimiento para un proveedor comprometido",
        "finding": "Los contratos citan un soporte pero ningún contacto de seguridad ni obligación de compartir indicadores.",
        "affected_capability": "third_party_supply_chain",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Inventario de software incierto",
        "finding": "Nadie puede decir en una hora qué servidores ejecutan una versión concreta de un agente.",
        "affected_capability": "incident_classification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Alerta temprana nunca ejercitada",
        "finding": "La alerta temprana de 24 horas nunca se ha ensayado con una causa en un tercero.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Trabajar con el proveedor",
        "statement": "Antes de terminar la primera tarde, el equipo obtiene del proveedor sus indicadores, cronología y plan de corrección, y decide sobre el acceso del agente.",
        "capability": "third_party_supply_chain",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Contacto de seguridad del proveedor localizado\nIndicadores y cronología pedidos por escrito\nDecisión sobre el agente registrada con su responsable",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La petición por escrito al proveedor y el registro de decisiones.",
        "regulatory_requirement_ids": [
          "NIS2-21-2-C"
        ]
      },
      {
        "code": "OBJ-02",
        "title": "Saber hasta dónde ha llegado",
        "statement": "En la hora siguiente al aviso, el equipo establece cuántos servidores ejecutan la versión afectada y cuáles muestran contacto con el atacante, y asigna una gravedad.",
        "capability": "incident_classification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Recuento de la versión afectada establecido\nEquipos con conexiones salientes listados\nGravedad asignada con sus criterios",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "La lista de activos y el registro de gravedad.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Alerta temprana a tiempo",
        "statement": "La responsable de cumplimiento decide si el incidente es significativo y, si lo es, tiene la alerta temprana aprobada antes de las 24 horas desde que se tuvo conocimiento.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Momento de conocimiento registrado\nSignificatividad decidida con sus motivos\nBorrador de alerta temprana aprobado antes del plazo",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El borrador de alerta temprana y su aprobación.",
        "regulatory_requirement_ids": [
          "NIS2-23"
        ]
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
    "title": "Versión 4.2.1",
    "summary": "Un proveedor de inteligencia avisa de que la versión 4.2.1 de un agente de monitorización muy extendido, distribuida automáticamente la semana pasada, contiene una puerta trasera. Tus servidores se actualizaron según lo previsto.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Aviso",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "Jueves, 09:10. Llega un aviso al buzón de seguridad.",
        "key_questions": [
          "¿En cuánto tiempo sabemos qué servidores ejecutan la 4.2.1?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          }
        ],
        "headline": "Una actualización de confianza trae una puerta trasera"
      },
      {
        "code": "PH-02",
        "name": "El proveedor y el corte",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 360,
        "situation_update": "Jueves, 15:00. El proveedor confirma la brecha pero aún no tiene corrección.",
        "key_questions": [
          "¿Qué pedimos al proveedor, por escrito?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "Cortar el agente es quedarse ciego"
      },
      {
        "code": "PH-03",
        "name": "Notificación",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1080,
        "situation_update": "Viernes, 07:00. Veintidós horas desde el aviso.",
        "key_questions": [
          "¿Es significativo para nosotros y quién firma la alerta temprana?"
        ],
        "objectives": [
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "El reloj de 24 horas"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Intruso en la cadena de suministro",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Un actor que comprometió el sistema de compilación del proveedor para distribuir una actualización con puerta trasera.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1195.002"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1072"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1048"
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
        "title": "Aviso: puerta trasera en el agente 4.2.1",
        "content": "El proveedor lo califica de crítico: la actualización 4.2.1 del agente de monitorización está firmada con el certificado real del proveedor pero contacta con infraestructura del atacante cada seis horas.",
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
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0001",
            "technique_id": "T1195.002"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "El responsable del incidente abre un incidente y pide la exposición en menos de una hora.",
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
        "artifact": null
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "312 servidores, 4 hablando hacia fuera",
        "content": "El inventario muestra 312 servidores con la 4.2.1. Cuatro de ellos, dos en la plataforma de pagos, conectaron con los indicadores publicados en la última semana.",
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
          "Operaciones de seguridad"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1048"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Operaciones de seguridad lista los cuatro equipos, los aísla o vigila, y se asigna la gravedad con sus criterios.",
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
        "title": "El proveedor devuelve la llamada",
        "content": "El proveedor confirma la intrusión en su sistema de compilación, pide a los clientes que no vuelvan atrás todavía, promete una versión corregida «en días» y no tiene lista de indicadores que compartir.",
        "offset_minutes": 60,
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
          "Gestor del proveedor"
        ],
        "delivery_method": "phone",
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
            "description": "El gestor del proveedor pide por escrito indicadores, cronología y plan de corrección, citando el contrato.",
            "responsible_role": "Gestor del proveedor",
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
        "title": "¿Desinstalarlo en todas partes?",
        "content": "Infraestructura puede quitar el agente de los 312 servidores esta noche, pero la monitorización y las alertas quedarían ciegas al menos dos días.",
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
          "Responsable del incidente",
          "Infraestructura"
        ],
        "delivery_method": "in_person",
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
            "description": "El responsable del incidente decide si quitar, bloquear o mantener el agente, y registra la decisión y su responsable.",
            "responsible_role": "Responsable del incidente",
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
        "title": "Había credenciales en el agente",
        "content": "El proveedor actualiza su aviso: la puerta trasera también leía las credenciales de servicio guardadas en la configuración del agente. El soporte del proveedor tiene una cola de cuatro horas.",
        "offset_minutes": null,
        "trigger_condition": "Sin petición escrita al proveedor 20 minutos después de INJ-03.",
        "contingent_purpose": "Mostrar el coste de esperar al proveedor.",
        "fires_at_minute": 50,
        "branch_from_code": "INJ-03",
        "branch_action_code": "INJ-03-A1",
        "rejoin_code": "INJ-06",
        "sender_code": "ACT-01",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Gestor del proveedor",
          "Responsable del incidente"
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
            "code": "INJ-05-A1",
            "description": "El gestor del proveedor escala al contacto de seguridad del proveedor y se rotan las credenciales del agente.",
            "responsible_role": "Gestor del proveedor",
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
        "code": "INJ-06",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "El boletín del CSIRT",
        "content": "El CSIRT nacional publica un boletín sobre el agente y pide a las entidades esenciales e importantes que ejecutaron la 4.2.1 que lo notifiquen. Dos de tus servidores afectados dan servicio a pagos.",
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
          "Responsable de cumplimiento"
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
            "description": "La responsable de cumplimiento decide sobre la significatividad y obtiene la aprobación de la alerta temprana antes del plazo.",
            "responsible_role": "Responsable de cumplimiento",
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
      "origin_id": "threat-intel-provider",
      "origin_name": "Proveedor de inteligencia de amenazas",
      "code": "ACT-01",
      "name": "Proveedor de inteligencia de amenazas",
      "type": "supplier",
      "description": "Vigila foros, sitios de filtraciones y redes: avisa de datos expuestos y de la actividad del atacante.",
      "channel": "email"
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
      "origin_id": "critical-supplier",
      "origin_name": "Proveedor crítico",
      "code": "ACT-03",
      "name": "Proveedor del software de monitorización",
      "type": "supplier",
      "description": "El proveedor cuyo agente se ejecuta en tus servidores.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "cybersecurity-team-member",
      "origin_name": "Miembro del equipo de ciberseguridad",
      "code": "ACT-04",
      "name": "Responsable de infraestructura",
      "type": "internal",
      "description": "Gestiona los servidores; le preocupa quedarse sin monitorización.",
      "channel": "security_tool"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-05",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
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
      "origin_id": "nis2",
      "origin_name": "NIS2",
      "name": "NIS2",
      "color": "slate",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "technical",
      "origin_name": "Técnico",
      "name": "Técnico",
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
