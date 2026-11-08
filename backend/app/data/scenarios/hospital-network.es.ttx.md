---
format: "ttx-zone.scenario"
format_version: 8
language: "es"
title: "Ransomware en un grupo hospitalario"
exported_at: "2026-11-05T00:00:00+00:00"
generator: "ttx-zone"
attack_version: "19.2"
---

# Ransomware en un grupo hospitalario

Simulacro de crisis para el comité ejecutivo de un grupo hospitalario privado. El ransomware alcanza los sistemas corporativos y amenaza el entorno clínico. En tres reuniones de crisis, el comité decide si desconectar las redes clínicas, cómo afrontar la extorsión y la filtración de datos de pacientes y en qué orden recuperar la asistencia.

> Escenario de TTX-Zone. Impórtalo desde Biblioteca → Escenarios. La parte legible se genera al exportar; solo se importa el bloque de datos del final.

## Objetivos

- **OBJ-01** Decidir el aislamiento con criterio clínico
- **OBJ-02** Gobernar la respuesta a la extorsión
- **OBJ-03** Asumir cada notificación
- **OBJ-04** Recuperar la asistencia, no los servidores
- **OBJ-05** Decir la verdad primero a pacientes y personal

## Escenario

{organization} gestiona {hospital_1}, {hospital_2} y una red de laboratorios y consultas externas. Los equipos clínicos dependen de {ehr_system}, de las plataformas de laboratorio e imagen y de dispositivos médicos conectados que comparten interfaces con la TI corporativa.

## Fases e injects

### PH-01 Aislar o no

Día 1, 10:40. El personal de la sede central no puede abrir sus archivos.

- **INJ-01** (T+5′) Cifrado en RR. HH. y carpetas del personal
- **INJ-02** (T+15′) Los equipos clínicos pierden visibilidad
- **INJ-03** (T+26′) El CISO recomienda aislar
- **POL-04** (T+36′) Redes clínicas
  - ¿Desconectas las redes clínicas de la TI corporativa?
    - Aislar todo ya y pasar a procedimientos manuales
      - El atacante queda fuera. Los diagnósticos se ralentizan de inmediato, el personal pasa al papel sin aviso y los clínicos sienten que se decidió sin ellos.
    - Aislar por etapas, empezando por lo que los clínicos dicen que puede esperar
      - Los clínicos marcan el orden y la asistencia es más segura. Lleva horas que quizá no tengas, y cada etapa deja una puerta abierta.
    - Mantener la conexión con vigilancia estrecha hasta tener pruebas de ataque a sistemas clínicos
      - La asistencia no se altera hoy. Si el atacante llega al lado clínico, el fallo será mucho peor y la decisión será tuya.
    - Aislar solo los dos hospitales y dejar conectados laboratorios y consultas
      - Protege los servicios de mayor riesgo. Laboratorios y consultas alimentan los mismos registros, así que la exposición se reduce, no se cierra.
- **DSC-05** (T+45′) Primera reunión de crisis

### PH-02 Extorsión y exposición

Día 2, de madrugada. Los hospitales trabajan en modo segmentado.

- **INJ-06** (T+60′) La nota de rescate
- **INJ-07** (T+68′) La prensa pregunta por los pacientes
- **INJ-08** (T+76′) Nóminas, privacidad y el deber de informar
- **INJ-09** (contingente) La autoridad sanitaria llama
- **INJ-10** (T+84′) Trabajando en modo segmentado
- **POL-11** (T+92′) La exigencia
  - El actor ha puesto 72 horas de plazo. ¿Cuál es tu posición?
    - Ningún contacto ni pago, y prepararse para la publicación
      - Una posición clara que personal y reguladores entienden. Los datos de pacientes probablemente se publicarán, y hay que estar preparado para ese día.
    - Permitir que especialistas abran un canal para saber qué se llevaron, sin compromiso de pago
      - Sabes qué está realmente en riesgo y ganas tiempo para los pacientes. Mal gestionado, parece negociar con historiales.
    - Considerar el pago si la asistencia no se puede restablecer de otro modo
      - La asistencia va primero y se entenderá el motivo. Nada garantiza una clave que funcione ni el borrado de datos, y puede haber límites legales.
    - Dejar la decisión en manos de la aseguradora y la policía
      - Asesorarán, pero no decidirán por ti. Pasa el tiempo y el resultado sigue siendo del comité.
- **DSC-12** (T+102′) Segunda reunión de crisis

### PH-03 Recuperar la asistencia

Día 6. La contención ha terminado y los hospitales siguen en papel. El principio rector: recuperar el servicio clínico, no solo el servidor.

- **INJ-13** (T+120′) La noticia llega a la prensa nacional
- **INJ-14** (T+130′) Plan de recuperación
- **POL-15** (T+142′) Qué vuelve primero
  - TI solo puede empezar hoy una línea de restauración. ¿Cuál?
    - Sistemas de urgencias y cuidados intensivos
      - Los pacientes más frágiles se benefician antes. Esos servicios dependen de laboratorio e imagen, así que la mejora puede ser menor de lo esperado.
    - Laboratorio, imagen y farmacia
      - Vuelven diagnóstico y medicación para todas las plantas, lo que elimina los pasos manuales más arriesgados. Los sistemas de urgencias esperan un poco más.
    - Nóminas y gestión de turnos
      - El personal cobra y los turnos se cubren, lo que mantiene a la gente trabajando. Los clínicos pueden verlo como anteponer la administración a los pacientes.
    - Cirugía programada, portal del paciente y facturación
      - Vuelven ingresos y accesos, y baja la presión de las listas de espera. Es la opción más difícil de defender con los clínicos en papel.
- **DSC-16** (T+155′) Tercera reunión de crisis

## Actores simulados

- **ACT-01** SOC
- **ACT-02** Atacante (remitente)
- **ACT-03** Medios de comunicación
- **ACT-04** Empleado
- **ACT-05** Aseguradora de ciberriesgo
- **ACT-06** Autoridad sanitaria
- **ACT-07** Equipo de operaciones clínicas

```json ttx-zone-scenario
{
  "format": "ttx-zone.scenario",
  "format_version": 8,
  "language": "es",
  "exported_at": "2026-11-05T00:00:00Z",
  "exercise": {
    "name": "Ransomware en un grupo hospitalario",
    "description": "Simulacro de crisis para el comité ejecutivo de un grupo hospitalario privado. El ransomware alcanza los sistemas corporativos y amenaza el entorno clínico. En tres reuniones de crisis, el comité decide si desconectar las redes clínicas, cómo afrontar la extorsión y la filtración de datos de pacientes y en qué orden recuperar la asistencia."
  },
  "needs": {
    "tlp": "amber",
    "triggers": [
      "annual_program",
      "new_threat"
    ],
    "trigger_other": "",
    "regulatory_frameworks": [
      "NIS2",
      "GDPR"
    ],
    "regulatory_framework_other": "",
    "capabilities": [
      "crisis_decision_making",
      "regulatory_notification",
      "continuity_recovery",
      "internal_external_comms"
    ],
    "levels": [
      "strategic"
    ],
    "participating_areas": [
      "Consejero delegado",
      "Dirección médica",
      "Dirección de enfermería",
      "Dirección de operaciones",
      "CISO",
      "Dirección de sistemas",
      "Legal",
      "Delegado de protección de datos",
      "Comunicación",
      "Recursos humanos",
      "Comité ejecutivo de crisis"
    ],
    "third_parties": [],
    "perimeter": "Decisiones ejecutivas sobre continuidad asistencial, extorsión, notificación, comunicación y prioridades de recuperación.",
    "out_of_scope": "Protocolos clínicos, trabajo forense técnico y cualquier contacto real con autoridades o pacientes.",
    "max_duration_hours": 3,
    "confidentiality_restrictions": "",
    "budget_and_external_support": "",
    "stop_exercise_keyword": "BATA BLANCA",
    "needs": [
      {
        "code": "NEED-01",
        "source": "regulatory",
        "title": "La desconexión no tiene responsable clínico",
        "finding": "El comité nunca ha decidido quién autoriza desconectar las redes clínicas ni qué información clínica necesita antes.",
        "affected_capability": "crisis_decision_making",
        "priority": "high"
      },
      {
        "code": "NEED-02",
        "source": "regulatory",
        "title": "Las notificaciones van por puertas distintas",
        "finding": "Las obligaciones de privacidad, autoridad sanitaria e incidentes tienen responsables distintos que nunca han trabajado juntos un caso.",
        "affected_capability": "regulatory_notification",
        "priority": "high"
      },
      {
        "code": "NEED-03",
        "source": "regulatory",
        "title": "Los planes de recuperación hablan de sistemas",
        "finding": "Los planes de recuperación de TI enumeran servidores, no los servicios clínicos que soportan ni cuánto puede durar el trabajo manual.",
        "affected_capability": "continuity_recovery",
        "priority": "high"
      }
    ],
    "objectives": [
      {
        "code": "OBJ-01",
        "title": "Decidir el aislamiento con criterio clínico",
        "statement": "El comité decide si desconecta las redes clínicas, con los responsables clínicos, y fija qué servicios deben seguir disponibles y quién acepta el riesgo.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Responsables clínicos escuchados antes de decidir\nServicios críticos nombrados\nResponsable del riesgo registrado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El acta del comité.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-02",
        "title": "Gobernar la respuesta a la extorsión",
        "statement": "El comité acuerda quién puede autorizar el contacto con el actor y con qué límites, con Legal, la aseguradora y la policía.",
        "capability": "crisis_decision_making",
        "need_codes": [
          "NEED-01"
        ],
        "success_criterion": "Responsable de la decisión nombrado\nLegal, aseguradora y policía consultados\nPosición registrada",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de decisiones.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-03",
        "title": "Asumir cada notificación",
        "statement": "Cada obligación ante la autoridad de protección de datos, la sanitaria y el CSIRT nacional tiene responsable y fecha, y los pacientes reciben lo que necesitan saber.",
        "capability": "regulatory_notification",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Responsables y fechas registrados\nDecisión sobre la brecha registrada\nMensaje a pacientes y personal aprobado",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El registro de notificaciones.",
        "regulatory_requirement_ids": [
          "GDPR-33-34",
          "NIS2-23"
        ]
      },
      {
        "code": "OBJ-04",
        "title": "Recuperar la asistencia, no los servidores",
        "statement": "El comité fija el orden en que vuelven los servicios clínicos, cuánto puede seguir el trabajo manual y quién valida cada paso.",
        "capability": "continuity_recovery",
        "need_codes": [
          "NEED-03"
        ],
        "success_criterion": "Orden de servicios acordado\nLímite de los procedimientos manuales conocido\nValidación clínica exigida antes de cada arranque",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "El plan de recuperación.",
        "regulatory_requirement_ids": []
      },
      {
        "code": "OBJ-05",
        "title": "Decir la verdad primero a pacientes y personal",
        "statement": "Los mensajes a pacientes, personal, socios y medios son coherentes y no confirman lo que no se sabe.",
        "capability": "internal_external_comms",
        "need_codes": [
          "NEED-02"
        ],
        "success_criterion": "Portavoz nombrado\nPersonal informado\nPreguntas sobre seguridad del paciente respondidas con hechos",
        "achieve_at_least": null,
        "time_box_minutes": null,
        "achieved_note": "",
        "partially_achieved": "",
        "not_achieved": "",
        "evidence": "Los mensajes aprobados.",
        "regulatory_requirement_ids": []
      }
    ],
    "risks": [
      {
        "risk": "Ocurre un incidente real durante la sesión.",
        "mitigation": "Cualquiera puede detener el ejercicio con la palabra clave."
      },
      {
        "risk": "Reclaman a los clínicos de la mesa.",
        "mitigation": "Se nombran suplentes por adelantado."
      }
    ],
    "next_need_number": 4,
    "next_objective_number": 6
  },
  "msel": {
    "title": "Red hospitalaria",
    "summary": "{organization} gestiona {hospital_1}, {hospital_2} y una red de laboratorios y consultas externas. Los equipos clínicos dependen de {ehr_system}, de las plataformas de laboratorio e imagen y de dispositivos médicos conectados que comparten interfaces con la TI corporativa.",
    "attack_version": "19.2",
    "duration_minutes": 175,
    "time_compression": 15,
    "phases": [
      {
        "code": "PH-01",
        "name": "Aislar o no",
        "start_offset": 0,
        "end_offset": 55,
        "incident_jump_minutes": 0,
        "situation_update": "Día 1, 10:40. El personal de la sede central no puede abrir sus archivos.",
        "key_questions": [
          "¿Qué información necesita el comité antes de la próxima decisión?",
          "¿Qué nivel de operación degradada es aceptable?"
        ],
        "objectives": [
          {
            "code": "OBJ-01",
            "due": true
          }
        ],
        "headline": "El ransomware a las puertas de los sistemas clínicos"
      },
      {
        "code": "PH-02",
        "name": "Extorsión y exposición",
        "start_offset": 55,
        "end_offset": 115,
        "incident_jump_minutes": 200,
        "situation_update": "Día 2, de madrugada. Los hospitales trabajan en modo segmentado.",
        "key_questions": [
          "¿Tratamos con el actor?",
          "¿Qué servicios pueden seguir con seguridad en modo degradado?"
        ],
        "objectives": [
          {
            "code": "OBJ-02",
            "due": true
          },
          {
            "code": "OBJ-03",
            "due": true
          },
          {
            "code": "OBJ-05",
            "due": true
          }
        ],
        "headline": "Una exigencia de rescate y datos de pacientes en internet"
      },
      {
        "code": "PH-03",
        "name": "Recuperar la asistencia",
        "start_offset": 115,
        "end_offset": 175,
        "incident_jump_minutes": 5235,
        "situation_update": "Día 6. La contención ha terminado y los hospitales siguen en papel. El principio rector: recuperar el servicio clínico, no solo el servidor.",
        "key_questions": [
          "¿Cuánto pueden sostenerse con seguridad los procesos en papel?",
          "¿Quién acepta el riesgo clínico residual?"
        ],
        "objectives": [
          {
            "code": "OBJ-04",
            "due": true
          }
        ],
        "headline": "¿En qué orden vuelve la asistencia?"
      }
    ],
    "threat_actors": [
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "THR-01",
        "name": "Grupo de ransomware",
        "mitre_group_id": null,
        "aliases": [],
        "description": "Grupo de extorsión que cifra, roba y publica muestras para forzar el pago.",
        "techniques": [
          {
            "domain": "enterprise",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1110.003"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1021"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1041"
          },
          {
            "domain": "enterprise",
            "technique_id": "T1657"
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
        "title": "Cifrado en RR. HH. y carpetas del personal",
        "content": "El centro de ciberdefensa ve cifrado y posible robo de datos en la plataforma de RR. HH. y en el almacenamiento del personal. Hay empleados que no pueden abrir archivos. El directorio parece comprometido, se abusa de credenciales y el atacante ha llegado a servidores de salto que dan servicio a hospitales y laboratorios. El siguiente paso podrían ser las interfaces compartidas con {ehr_system}, laboratorio, imagen y monitorización de dispositivos.",
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
          "Dirección de sistemas"
        ],
        "delivery_method": "ticket",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1486"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0006",
            "technique_id": "T1003"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0008",
            "technique_id": "T1021"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-01-A1",
            "description": "Declara un incidente de máxima prioridad y convoca al comité ejecutivo de crisis.",
            "responsible_role": "CISO",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-02",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Los equipos clínicos pierden visibilidad",
        "content": "Se está perdiendo visibilidad en la tecnología clínica de {hospital_1} y {hospital_2}. El soporte vital y las funciones de seguridad del paciente siguen operativos, pero los equipos no pueden verificar del todo dispositivos conectados, interfaces de diagnóstico ni monitorización central. Se prepara el aislamiento de la TI corporativa, que eliminaría el soporte remoto, retrasaría diagnósticos y obligaría a comprobaciones locales.",
        "offset_minutes": 15,
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
          "Dirección médica",
          "Dirección de enfermería",
          "Dirección de operaciones"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-02-A1",
            "description": "Indica qué servicios pueden pasar a manual y cuáles no pueden cortarse sin validación clínica.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-01"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-03",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "El CISO recomienda aislar",
        "content": "Del CISO: el ransomware está confirmado, con cifrado y robo de datos, y las credenciales robadas han llegado a sistemas que soportan la tecnología clínica. Recomiendo aislar las redes clínicas de la TI corporativa. Perderéis visibilidad remota e interfaces de diagnóstico, y la ingeniería presencial tendrá que mantener la asistencia segura. Necesito una decisión del comité.",
        "offset_minutes": 26,
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
          "Comité ejecutivo de crisis"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-01"
        ],
        "expected_actions": [
          {
            "code": "INJ-03-A1",
            "description": "Pide su posición a los responsables clínicos antes de decidir.",
            "responsible_role": "Consejero delegado",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-01"
            ]
          },
          {
            "code": "INJ-03-A2",
            "description": "Decide sobre el aislamiento, nombra al responsable del riesgo y fija qué debe seguir funcionando.",
            "responsible_role": "Comité ejecutivo de crisis",
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
          "sender": "CISO",
          "sender_address": "ciso@hospital.example.org",
          "recipient": "Comité ejecutivo de crisis",
          "subject": "Decisión necesaria: redes clínicas",
          "timestamp": "Día 1, 11:15",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-04",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Redes clínicas",
        "content": "El atacante puede llegar a las interfaces clínicas en cuestión de horas.",
        "offset_minutes": 36,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "¿Desconectas las redes clínicas de la TI corporativa?",
        "poll_options": [
          "Aislar todo ya y pasar a procedimientos manuales",
          "Aislar por etapas, empezando por lo que los clínicos dicen que puede esperar",
          "Mantener la conexión con vigilancia estrecha hasta tener pruebas de ataque a sistemas clínicos",
          "Aislar solo los dos hospitales y dejar conectados laboratorios y consultas"
        ],
        "poll_outcomes": [
          "El atacante queda fuera. Los diagnósticos se ralentizan de inmediato, el personal pasa al papel sin aviso y los clínicos sienten que se decidió sin ellos.",
          "Los clínicos marcan el orden y la asistencia es más segura. Lleva horas que quizá no tengas, y cada etapa deja una puerta abierta.",
          "La asistencia no se altera hoy. Si el atacante llega al lado clínico, el fallo será mucho peor y la decisión será tuya.",
          "Protege los servicios de mayor riesgo. Laboratorios y consultas alimentan los mismos registros, así que la exposición se reduce, no se cierra."
        ],
        "poll_impacts": [
          {
            "m1": 2,
            "m2": 1,
            "m3": 3,
            "m4": 1
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 3,
            "m2": 3,
            "m3": 1,
            "m4": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 2,
            "m4": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-05",
        "phase_code": "PH-01",
        "kind": "mandatory",
        "title": "Primera reunión de crisis",
        "content": "Los sistemas corporativos están cifrados y las identidades comprometidas. Las funciones de seguridad del paciente siguen operativas y las plataformas clínicas compartidas están en riesgo. ¿Qué servicios deben seguir disponibles y qué necesitáis saber antes del próximo punto de decisión?",
        "offset_minutes": 45,
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
          "Comité ejecutivo de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Pide a cada directivo un requisito de información. Anótalos: enmarcan la segunda reunión.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-06",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La nota de rescate",
        "content": "Vuestra red es nuestra. Ya hemos publicado como muestra registros de nóminas y de administración de pacientes. Pagad en 72 horas o publicaremos todo, datos clínicos e identificativos incluidos.",
        "offset_minutes": 60,
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
          "Comité ejecutivo de crisis",
          "Legal"
        ],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [
          {
            "domain": "enterprise",
            "tactic_id": "TA0040",
            "technique_id": "T1657"
          },
          {
            "domain": "enterprise",
            "tactic_id": "TA0010",
            "technique_id": "T1041"
          }
        ],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-02"
        ],
        "expected_actions": [
          {
            "code": "INJ-06-A1",
            "description": "Nombra quién puede autorizar cualquier contacto y con qué límites.",
            "responsible_role": "Consejero delegado",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-02"
            ]
          },
          {
            "code": "INJ-06-A2",
            "description": "Implica a la aseguradora y la policía antes de decidir.",
            "responsible_role": "Legal",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-02"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-07",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La prensa pregunta por los pacientes",
        "content": "Unos investigadores me han mostrado un listado de filtración que parece incluir nóminas e información de pacientes de {organization}. ¿Estáis sufriendo un ataque? ¿Hay historias clínicas, diagnósticos o dispositivos médicos afectados? ¿Podrían verse afectadas urgencias o las intervenciones programadas? ¿Qué hacéis para proteger a pacientes, personal y clínicas asociadas?",
        "offset_minutes": 68,
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
          "Comunicación",
          "Consejero delegado"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-07-A1",
            "description": "Acuerda una posición provisional que no confirme lo que aún se desconoce.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "email",
          "sender": "Redacción de sanidad",
          "sender_address": "health.desk@news.example.org",
          "recipient": "Equipo directivo",
          "subject": "Posible ataque: preguntas antes de publicar",
          "timestamp": "Día 2, 06:30",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-08",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Nóminas, privacidad y el deber de informar",
        "content": "Recursos Humanos avisa de que la plataforma de nóminas sigue caída con el día de pago cerca, y el personal pregunta por salarios y datos expuestos sin que haya un mensaje general. El delegado de protección de datos prepara una notificación sobre datos de empleados y de administración de pacientes, y pregunta quién hablará con la autoridad sanitaria.",
        "offset_minutes": 76,
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
          "Recursos humanos",
          "Delegado de protección de datos",
          "Comité ejecutivo de crisis"
        ],
        "delivery_method": "in_person",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03",
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-08-A1",
            "description": "Confirma la decisión de notificar, su responsable y el plazo.",
            "responsible_role": "Delegado de protección de datos",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-03"
            ]
          },
          {
            "code": "INJ-08-A2",
            "description": "Envía al personal un mensaje sobre nóminas, turnos y sus datos.",
            "responsible_role": "Recursos humanos",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-09",
        "phase_code": "PH-02",
        "kind": "contingent",
        "title": "La autoridad sanitaria llama",
        "content": "La autoridad sanitaria se ha enterado del incidente por la prensa y pregunta por qué no se le informó, qué capacidad tenéis hoy en urgencias y cuidados intensivos, y si otros proveedores deben atender a vuestros pacientes.",
        "offset_minutes": null,
        "trigger_condition": "Sin responsable ante la autoridad sanitaria 10 minutos después de INJ-08.",
        "contingent_purpose": "Llevar a la autoridad sanitaria a la sala.",
        "fires_at_minute": 34,
        "branch_from_code": "INJ-08",
        "branch_action_code": "INJ-08-A1",
        "rejoin_code": "POL-11",
        "sender_code": "ACT-06",
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [
          "Dirección de operaciones",
          "Dirección médica"
        ],
        "delivery_method": "phone",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-03"
        ],
        "expected_actions": [
          {
            "code": "INJ-09-A1",
            "description": "Da un estado de capacidad y nombra un único contacto para la autoridad.",
            "responsible_role": "Dirección de operaciones",
            "expected_within_minutes": 8,
            "objective_codes": [
              "OBJ-03"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-10",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Trabajando en modo segmentado",
        "content": "Los servicios clínicos continúan. Ingeniería y algunos proveedores deben trabajar presencialmente. Comprobaciones de dispositivos, diagnósticos y traslados de pacientes son en parte manuales, y se han cortado los servicios internacionales compartidos. Eliminar más conexiones externas puede afectar a citas, telemedicina e informes remotos.",
        "offset_minutes": 84,
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
          "Dirección médica",
          "Dirección de enfermería",
          "Dirección de operaciones"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-10-A1",
            "description": "Identifica qué pacientes o procedimientos requieren traslado, aplazamiento o más garantías.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-11",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "La exigencia",
        "content": "Hay datos de pacientes en juego y el plazo corre.",
        "offset_minutes": 92,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "El actor ha puesto 72 horas de plazo. ¿Cuál es tu posición?",
        "poll_options": [
          "Ningún contacto ni pago, y prepararse para la publicación",
          "Permitir que especialistas abran un canal para saber qué se llevaron, sin compromiso de pago",
          "Considerar el pago si la asistencia no se puede restablecer de otro modo",
          "Dejar la decisión en manos de la aseguradora y la policía"
        ],
        "poll_outcomes": [
          "Una posición clara que personal y reguladores entienden. Los datos de pacientes probablemente se publicarán, y hay que estar preparado para ese día.",
          "Sabes qué está realmente en riesgo y ganas tiempo para los pacientes. Mal gestionado, parece negociar con historiales.",
          "La asistencia va primero y se entenderá el motivo. Nada garantiza una clave que funcione ni el borrado de datos, y puede haber límites legales.",
          "Asesorarán, pero no decidirán por ti. Pasa el tiempo y el resultado sigue siendo del comité."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 2
          },
          {
            "m1": 1,
            "m2": 2,
            "m3": 2,
            "m4": 2,
            "m5": 1
          },
          {
            "m1": 1,
            "m2": 3,
            "m3": 2,
            "m4": 3,
            "m5": 3
          },
          {
            "m1": 2,
            "m2": 2,
            "m3": 1,
            "m4": 2,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-12",
        "phase_code": "PH-02",
        "kind": "mandatory",
        "title": "Segunda reunión de crisis",
        "content": "Hospitales y laboratorios están en modo segmentado, hay datos personales publicados como muestra, la prensa pregunta por la seguridad del paciente y Recursos Humanos está preocupado por nóminas y personal. ¿Qué servicios clínicos pueden continuar con seguridad, qué decís a pacientes y clínicos y quién se encarga de cada notificación?",
        "offset_minutes": 102,
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
          "Comité ejecutivo de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Comprueba si cada notificación tiene responsable. Si no, para y asígnalos.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-13",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "La noticia llega a la prensa nacional",
        "content": "{organization} ha sufrido un ciberataque, con posible exposición de datos de pacientes, personal y finanzas, intervenciones no urgentes canceladas, diagnósticos con retraso y dudas sobre la capacidad de urgencias. Algunas fuentes cuestionan si se comprometió la seguridad del paciente y si el grupo cumplió su deber de notificar.",
        "offset_minutes": 120,
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
          "Comunicación",
          "Consejero delegado"
        ],
        "delivery_method": "media",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-05"
        ],
        "expected_actions": [
          {
            "code": "INJ-13-A1",
            "description": "Coordina un mensaje único sobre seguridad del paciente, continuidad, privacidad y recuperación.",
            "responsible_role": "Comunicación",
            "expected_within_minutes": 10,
            "objective_codes": [
              "OBJ-05"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": {
          "kind": "press_release",
          "sender": "Medio nacional",
          "sender_address": "",
          "recipient": "",
          "subject": "Un ciberataque golpea a un grupo hospitalario y se teme por los datos de pacientes",
          "timestamp": "Día 6, 10:00",
          "location": ""
        },
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "INJ-14",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Plan de recuperación",
        "content": "Del CISO: la contención ha terminado y empieza la recuperación. La tecnología clínica sigue aislada y la asistencia continúa degradada, con flujos en papel y procedimientos manuales de medicación, laboratorio e imagen en revisión. TI puede restaurar en varios órdenes. Cada interfaz restaurada necesita validación técnica y clínica antes de usarse con pacientes. ¿Qué va primero?",
        "offset_minutes": 130,
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
          "Comité ejecutivo de crisis",
          "Dirección médica",
          "Dirección de sistemas"
        ],
        "delivery_method": "email",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "",
        "objective_codes": [
          "OBJ-04"
        ],
        "expected_actions": [
          {
            "code": "INJ-14-A1",
            "description": "Fija las prioridades clínicas y cuánto puede durar con seguridad el trabajo manual.",
            "responsible_role": "Dirección médica",
            "expected_within_minutes": 12,
            "objective_codes": [
              "OBJ-04"
            ]
          },
          {
            "code": "INJ-14-A2",
            "description": "Convierte las prioridades en una secuencia de restauración validada.",
            "responsible_role": "Dirección de sistemas",
            "expected_within_minutes": 15,
            "objective_codes": [
              "OBJ-04"
            ]
          }
        ],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "inject",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "POL-15",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Qué vuelve primero",
        "content": "Todo es urgente para alguien.",
        "offset_minutes": 142,
        "trigger_condition": "",
        "contingent_purpose": "",
        "fires_at_minute": null,
        "branch_from_code": null,
        "branch_action_code": null,
        "rejoin_code": null,
        "sender_code": null,
        "attack_attribution": null,
        "threat_actor_code": null,
        "recipients": [],
        "delivery_method": "document",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Cierra la votación confirmando la opción elegida y muestra el resultado: la mesa lee su consecuencia. El siguiente inject funciona gane la opción que gane. Cada decisión suma en los medidores: muestra su resumen en el hot wash.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "poll",
        "poll_question": "TI solo puede empezar hoy una línea de restauración. ¿Cuál?",
        "poll_options": [
          "Sistemas de urgencias y cuidados intensivos",
          "Laboratorio, imagen y farmacia",
          "Nóminas y gestión de turnos",
          "Cirugía programada, portal del paciente y facturación"
        ],
        "poll_outcomes": [
          "Los pacientes más frágiles se benefician antes. Esos servicios dependen de laboratorio e imagen, así que la mejora puede ser menor de lo esperado.",
          "Vuelven diagnóstico y medicación para todas las plantas, lo que elimina los pasos manuales más arriesgados. Los sistemas de urgencias esperan un poco más.",
          "El personal cobra y los turnos se cubren, lo que mantiene a la gente trabajando. Los clínicos pueden verlo como anteponer la administración a los pacientes.",
          "Vuelven ingresos y accesos, y baja la presión de las listas de espera. Es la opción más difícil de defender con los clínicos en papel."
        ],
        "poll_impacts": [
          {
            "m1": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 1,
            "m3": 2,
            "m4": 1
          },
          {
            "m1": 2,
            "m3": 1,
            "m4": 2
          },
          {
            "m1": 3,
            "m3": 3,
            "m4": 3,
            "m5": 1
          }
        ]
      },
      {
        "origin": null,
        "origin_id": null,
        "origin_name": null,
        "code": "DSC-16",
        "phase_code": "PH-03",
        "kind": "mandatory",
        "title": "Tercera reunión de crisis",
        "content": "La contención ha terminado, la prensa cubre la filtración de datos de pacientes y personal y la asistencia sigue degradada. ¿Cuál es la secuencia segura para restaurar los servicios clínicos? ¿Deben pasar pacientes a otros proveedores? ¿Quién acepta el riesgo residual y qué mejoras debería acelerar la crisis?",
        "offset_minutes": 155,
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
          "Comité ejecutivo de crisis"
        ],
        "delivery_method": "briefing",
        "attachment_notes": [],
        "attack_techniques": [],
        "facilitator_notes": "Usa la cuenta de las votaciones. Cierra con lo que debe comunicarse a hospitales, laboratorios y socios, y las mejoras con responsable y fecha.",
        "objective_codes": [],
        "expected_actions": [],
        "images": [],
        "room_codes": [],
        "files": [],
        "artifact": null,
        "format": "discussion",
        "poll_question": "",
        "poll_options": [],
        "poll_outcomes": [],
        "poll_impacts": []
      }
    ],
    "next_phase_number": 4,
    "next_inject_number": 17,
    "next_threat_actor_number": 2,
    "meters": [
      {
        "key": "m1",
        "name": "Seguridad del paciente"
      },
      {
        "key": "m2",
        "name": "Riesgo del actor"
      },
      {
        "key": "m3",
        "name": "Carga del personal"
      },
      {
        "key": "m4",
        "name": "Legal y reputación"
      },
      {
        "key": "m5",
        "name": "Presupuesto"
      }
    ]
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
      "origin_id": "media",
      "origin_name": "Medios de comunicación",
      "code": "ACT-03",
      "name": "Medios de comunicación",
      "type": "media",
      "description": "Periodistas que preguntan o publican sobre el incidente.",
      "channel": "media"
    },
    {
      "origin": "system",
      "origin_id": "insider",
      "origin_name": "Empleado",
      "code": "ACT-04",
      "name": "Empleado",
      "type": "internal",
      "description": "Un empleado que avisa de algo extraño, o el insider que está detrás.",
      "channel": "in_person"
    },
    {
      "origin": "system",
      "origin_id": "cyber-insurer",
      "origin_name": "Aseguradora de ciberriesgo",
      "code": "ACT-05",
      "name": "Aseguradora de ciberriesgo",
      "type": "other",
      "description": "La aseguradora: condiciones de la póliza, proveedores aprobados y plazos de aviso.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-06",
      "name": "Autoridad sanitaria",
      "type": "authority",
      "description": "La autoridad responsable de los servicios sanitarios y de la coordinación entre proveedores.",
      "channel": "phone"
    },
    {
      "origin": null,
      "origin_id": null,
      "origin_name": null,
      "code": "ACT-07",
      "name": "Equipo de operaciones clínicas",
      "type": "internal",
      "description": "El equipo que informa del estado de la tecnología clínica y la asistencia.",
      "channel": "email"
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
      "origin_id": "executive",
      "origin_name": "Directivo",
      "name": "Directivo",
      "color": "indigo",
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
      "origin_id": "gdpr",
      "origin_name": "RGPD",
      "name": "RGPD",
      "color": "slate",
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
  "next_room_number": 1,
  "files": []
}
```
