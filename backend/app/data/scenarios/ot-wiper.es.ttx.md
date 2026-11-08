---
format: "ttx-zone.scenario"
format_version: 3
language: "es"
title: "Ataque destructivo contra una flota energética distribuida"
exported_at: "2026-10-31T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ataque destructivo contra una flota energética distribuida

Un actor vinculado a un Estado destruye las unidades remotas de decenas de instalaciones renovables y despliega un borrado masivo por el dominio de una planta de calor, en plena ola de frío y justo antes de un festivo. Operaciones, ciberseguridad y dirección deben mantener el servicio sin control remoto, decidir qué restaurar primero e informar a las autoridades.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Incidente declarado
- **OBJ-02** Operación segura sin control remoto
- **OBJ-03** Autoridades y público informados

## Escenario

De madrugada, dos días antes de un festivo, la sala de control de {organization} empieza a perder el contacto con sus instalaciones remotas de generación una tras otra. Horas después, la protección de endpoints de la planta de calor detecta un borrado masivo de ficheros. Nadie pide nada: el ataque es puramente destructivo.

## Fases e injects

### PH-01 Pérdida de visión

05:30, invierno, dos días antes de un festivo. La sala de control pierde el contacto con las instalaciones remotas una tras otra.

- **INJ-01** (T+5′) La sala de control pierde la comunicación con muchas instalaciones
- **INJ-02** (T+30′) Un equipo que se reinicia en bucle

### PH-02 Borrado en la planta

07:00. La protección de endpoints de la planta de calor detecta un borrado masivo en puestos de operación y servidores.

- **INJ-03** (T+55′) Borrado masivo en la planta de calor
- **INJ-04** (T+85′) El operador del sistema pregunta qué está en riesgo

### PH-03 Restaurar e informar

Día 2. Los equipos de campo confirman equipos destruidos; llaman las autoridades y la prensa.

- **INJ-05** (T+115′) El CSIRT nacional pide la alerta temprana
- **INJ-06** (T+135′) ¿Está en riesgo la calefacción?
- **INJ-07** (T+150′) No hay repuestos para todas las instalaciones

## Actores simulados

- **ACT-01** Empleado
- **ACT-02** SOC
- **ACT-03** Operador del sistema eléctrico
- **ACT-04** CSIRT nacional
- **ACT-05** Medios de comunicación

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 3,
  "language": "es",
  "exported_at": "2026-10-31T00:00:00Z",
  "exercise": {
    "name": "Ataque destructivo contra una flota energética distribuida",
    "description": "Un actor vinculado a un Estado destruye las unidades remotas de decenas de instalaciones renovables y despliega un borrado masivo por el dominio de una planta de calor, en plena ola de frío y justo antes de un festivo. Operaciones, ciberseguridad y dirección deben mantener el servicio sin control remoto, decidir qué restaurar primero e informar a las autoridades."
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
      "detection_triage_escalation",
      "regulatory_notification"
    ],
    "levels": [
      "strategic",
      "tactical"
    ],
    "participating_areas": [
      "Comité de crisis",
      "Sala de control",
      "Operaciones",
      "Seguridad OT",
      "Operaciones de seguridad",
      "Comunicación",
      "Legal",
      "Responsable de operaciones",
      "Responsable de seguridad OT",
      "Dirección de planta",
      "CISO",
      "Dirección de operaciones",
      "Responsable de cumplimiento",
      "Responsable de comunicación"
    ],
    "third_parties": [
      "Operador del sistema eléctrico"
    ],
    "perimeter": "Las instalaciones remotas de generación, la planta de calor, la sala de control y el comité de crisis.",
    "out_of_scope": "La recuperación práctica de los equipos de campo.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "COLD HARBOUR",
    "needs": [
      {
        "code": "NEED-01",
        "source": "incident_history",
        "title": "Las alarmas OT no se escalan a ciberseguridad",
        "finding": "Los fallos de comunicación se tratan siempre como averías de telecomunicaciones; nadie es responsable de declararlos incidente de ciberseguridad.",
        "affected_capability": "detection_triage_escalation",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "risk_analysis",
        "title": "Sin plan para perder muchas instalaciones a la vez",
        "finding": "Los planes de continuidad contemplan una instalación cada vez, no la pérdida simultánea de visión y control remotos en toda la flota.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Notificación de un servicio esencial sin ensayar",
        "finding": "La alerta temprana a las autoridades y la información debida al operador del sistema nunca se han ensayado.",
        "affected_capability": "regulatory_notification",
        "priority": "medium"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Incidente declarado",
        "statement": "Operaciones escala la pérdida de comunicaciones a ciberseguridad y se declara un incidente en menos de 60 minutos, aunque la causa sea desconocida.",
        "capability": "detection_triage_escalation",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Escalado a ciberseguridad registrado\nIncidente declarado con un responsable",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Registro de la sala de control y cronología de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Operación segura sin control remoto",
        "statement": "El equipo decide cómo funcionan en local las instalaciones afectadas y en qué orden se restauran, con criterios escritos.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Operación local decidida\nOrden y criterios de restauración acordados",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Actas del comité y plan de restauración.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Autoridades y público informados",
        "statement": "El comité decide qué notificar, a quién y cuándo, y qué decir al operador del sistema y al público sobre el suministro.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Alerta temprana decidida\nMensaje público aprobado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Borrador de notificación y comunicado aprobado.",
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
    "title": "Instalaciones a oscuras en plena ola de frío",
    "summary": "De madrugada, dos días antes de un festivo, la sala de control de {organization} empieza a perder el contacto con sus instalaciones remotas de generación una tras otra. Horas después, la protección de endpoints de la planta de calor detecta un borrado masivo de ficheros. Nadie pide nada: el ataque es puramente destructivo.",
    "attack_version": "19.2",
    "duration_minutes": 170,
    "time_compression": 60,
    "phases": [
      {
        "code": "PH-01",
        "name": "Pérdida de visión",
        "start_offset": 0,
        "end_offset": 50,
        "incident_jump_minutes": 0,
        "situation_update": "05:30, invierno, dos días antes de un festivo. La sala de control pierde el contacto con las instalaciones remotas una tras otra.",
        "key_questions": [
          "¿Avería o ataque? ¿Quién lo decide?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          },
          {
            "code": "OBJ-02",
            "due": false
          }
        ],
        "headline": "Las instalaciones remotas se apagan"
      },
      {
        "code": "PH-02",
        "name": "Borrado en la planta",
        "start_offset": 50,
        "end_offset": 110,
        "incident_jump_minutes": 90,
        "situation_update": "07:00. La protección de endpoints de la planta de calor detecta un borrado masivo en puestos de operación y servidores.",
        "key_questions": [
          "¿Podemos mantener el calor y la electricidad sin nuestros sistemas?"
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
        "headline": "Borrado masivo en la planta de calor"
      },
      {
        "code": "PH-03",
        "name": "Restaurar e informar",
        "start_offset": 110,
        "end_offset": 170,
        "incident_jump_minutes": 1440,
        "situation_update": "Día 2. Los equipos de campo confirman equipos destruidos; llaman las autoridades y la prensa.",
        "key_questions": [
          "¿Qué restauramos primero y qué contamos?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          }
        ],
        "headline": "Día 2: pocos repuestos y muchas preguntas"
      }
    ],
    "threat_actors": [
      {
        "origin": "system",
        "origin_id": "G0034",
        "origin_name": "Sandworm Team",
        "code": "THR-01",
        "name": "Sandworm Team",
        "mitre_group_id": "G0034",
        "aliases": [],
        "description": "Actor vinculado a un Estado centrado en ataques destructivos contra infraestructuras energéticas.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1133"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1078"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1485"
          },
          {
            "domain": "ics",
            "technique_id": "T0829"
          },
          {
            "domain": "ics",
            "technique_id": "T0816"
          }
        ]
      }
    ],
    "injects": [
      {
        "origin": "system",
        "origin_id": "INJ-ICS-03",
        "origin_name": "La sala de control pierde la comunicación con muchas instalaciones",
        "code": "INJ-01",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "La sala de control pierde la comunicación con muchas instalaciones",
        "content": "Resumen de alarmas del turno: las unidades remotas no responden en 27 de 34 instalaciones, alarmas en secuencia durante 40 minutos. Telemetría congelada, órdenes remotas rechazadas. El operador de telecomunicaciones no informa de ninguna incidencia. Nota del operador: se sospecha una avería de telecomunicaciones.",
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
          "Sala de control",
          "Operaciones"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0829"
          },
          {
            "domain": "ics",
            "tactic_id": "TA0105",
            "technique_id": "T0827"
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
            "description": "Operaciones escala a ciberseguridad, no solo al operador de telecomunicaciones, y se declara un incidente.",
            "responsible_role": "Responsable de operaciones",
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
        "title": "Un equipo que se reinicia en bucle",
        "content": "Un técnico de campo llama desde una instalación: la unidad remota responde, se cae y vuelve a reiniciarse. «¿La cambio por la de repuesto o la dejo así para que la miréis?». Mientras, dos instalaciones informan de que no se conoce el estado de los relés de protección.",
        "offset_minutes": 30,
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
          "Seguridad OT",
          "Operaciones"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "ics",
            "tactic_id": "TA0107",
            "technique_id": "T0816"
          }
        ],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-01",
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Seguridad OT decide si conserva el equipo para el análisis forense antes de sustituirlo.",
            "responsible_role": "Responsable de seguridad OT",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-02-A2",
            "description": "Operaciones pasa las instalaciones afectadas a operación local o manual.",
            "responsible_role": "Responsable de operaciones",
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
        "code": "INJ-03",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Borrado masivo en la planta de calor",
        "content": "Protección de endpoints de la planta de calor: se están sobrescribiendo ficheros en puestos de operación y controladores de dominio; el borrado se propaga mediante directivas de grupo. Los ficheros señuelo lo han frenado en parte de los equipos, pero hay más de cien afectados.",
        "offset_minutes": 55,
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
          "Operaciones de seguridad",
          "Dirección de planta"
        ],
        "delivery_method": "security_tool",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1485"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0004",
            "technique_id": "T1484.001"
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
            "description": "Ciberseguridad aísla la red corporativa de la planta de sus sistemas de control.",
            "responsible_role": "CISO",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "La planta confirma que se mantiene el suministro de calor y dota de personal la operación manual si hace falta.",
            "responsible_role": "Dirección de planta",
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
        "title": "El operador del sistema pregunta qué está en riesgo",
        "content": "Llama el operador del sistema eléctrico: ve decenas de vuestras instalaciones sin telemetría y pregunta cuánta capacidad está en riesgo, si seguís controlándola y cuándo prevéis recuperar la operación remota.",
        "offset_minutes": 85,
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
          "Dirección de operaciones",
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
            "code": "INJ-04-A1",
            "description": "Da al operador del sistema una estimación y un interlocutor único.",
            "responsible_role": "Dirección de operaciones",
            "expected_within_minutes": 15,
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
        "code": "INJ-05",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "El CSIRT nacional pide la alerta temprana",
        "content": "El CSIRT nacional ha recibido informes de ataques contra operadores energéticos y pregunta si {organization} está afectada, pide la alerta temprana y cualquier indicador que podáis compartir.",
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
          "Responsable de cumplimiento",
          "CISO"
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
            "description": "Decide y envía la alerta temprana con lo que se sabe.",
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
        "title": "¿Está en riesgo la calefacción?",
        "content": "Llama una periodista de una radio regional: los oyentes dicen que «han hackeado a la compañía energética» y pregunta si los hogares se quedarán sin calefacción durante la ola de frío.",
        "offset_minutes": 135,
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
            "code": "INJ-06-A1",
            "description": "Aprueba un mensaje público sobre la continuidad del suministro.",
            "responsible_role": "Responsable de comunicación",
            "expected_within_minutes": 15,
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
        "code": "INJ-07",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "No hay repuestos para todas las instalaciones",
        "content": "Operaciones de campo informa: hay que sustituir 19 unidades remotas, hay 6 repuestos y tres equipos de guardia durante el festivo. Necesitan saber qué instalaciones van primero.",
        "offset_minutes": 150,
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
          "Comité de crisis",
          "Operaciones"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "scored": true,
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Acuerda el orden de restauración y deja escritos los criterios.",
            "responsible_role": "Comité de crisis",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 8,
    "next_threat_actor_number": 2
  },
  "cast": [
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-01",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
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
      "origin_id": "electricity-operator",
      "origin_name": "Operador del sistema eléctrico",
      "code": "ACT-03",
      "name": "Operador del sistema eléctrico",
      "type": "other",
      "description": "El operador del sistema de transporte que coordina la red durante el incidente.",
      "channel": "phone"
    },
    {
      "origin": "system",
      "origin_id": "national-csirt",
      "origin_name": "CSIRT nacional",
      "code": "ACT-04",
      "name": "CSIRT nacional",
      "type": "csirt",
      "description": "El equipo nacional de respuesta a incidentes: pide notificaciones y comparte indicadores.",
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
      "origin_id": "wiper",
      "origin_name": "Wiper",
      "name": "Wiper",
      "color": "rose",
      "custom_hex": null,
      "applied": true
    },
    {
      "origin": "system",
      "origin_id": "ot-ics",
      "origin_name": "OT / ICS",
      "name": "OT / ICS",
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
