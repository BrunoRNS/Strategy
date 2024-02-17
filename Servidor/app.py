##### Bibliotecas importadas

from copy import deepcopy
from flask import Flask, request, jsonify, render_template, url_for
import json
from sqlitedict import SqliteDict


##### variaveis do banco de dados

db = SqliteDict("data/Data.db", autocommit=True)

if 'hasbattle' in db:
  pass
else:
  db.hasbattle: bool = False # type: ignore

if 'resultado' in db:
  pass
else:
  db.resultado: list[tuple[str, int | float]] = [] # type: ignore

if 'morebattles' in db:
  pass
else:
  db.morebattles: list[tuple[str, int | float]] = [] # type: ignore

# Jogador: Unidade Militar: [0] -> int, quantidade. [1] -> tuple :
# (int -> X, int -> Y, (data -> tuple (float -> vida, float -> dano,
# int -> alcance, int -> velocidade)))

##### Constante Isolada
jogadores: dict = json.loads("""
{
  "Turno": 0,
  "Jogador 1": {
    "pais": "URSS",
    "nomecliente": "",
    "Turno-local": 0,
    "sistema_de_governo": "Socialismo",
    "recursos": {
      "pratas": 100000,
      "Trigo": 5000,
      "Ferro": 5000,
      "Petróleo": 5000,
      "Carvão": 5000,
      "Peixe": 5000,
      "Madeira": 5000
    },
    "mudança_de_recursos": {
      "Trigo": -1000,
      "Peixe": -2000,
      "Madeira": 0,
      "Ferro": 1000,
      "Carvão": 0,
      "Petróleo": 1000
    },
    "moral": 100,
    "moralClasses":  {
        "Baixa" : [100, -5],
        "Media" : [100, -5],
        "Alta" : [100, -5]

    },

    "mudanca_moral": -5,
    "quantidade de fabricas": 0,
    "Torpedeiros": [
      0
    ],
    "Canhoteiros": [
      0
    ],
    "Fragatas": [
      0
    ],
    "Contratorpedeiros": [
      0
    ],
    "Cruzadores": [
      0
    ],
    "Encouraçados": [
      0
    ],
    "base-naval": 0,
    "Construções": {
      "Fazendas": 0,
      "Portos": 0,
      "Marcenarias": 0,
      "Minas de Ferro": 0,
      "Minas de Carvão": 0,
      "Petrolíferas": 0
    }
  },
  "Jogador 2": {
    "pais": "EUA(midway)",
    "nomecliente": "",
    "Turno-local": 0,
    "sistema_de_governo": "Republica",
    "recursos": {
        "pratas": 100000,
        "Trigo": 5000,
        "Ferro": 5000,
        "Petróleo": 5000,
        "Carvão": 5000,
        "Peixe": 5000,
        "Madeira": 5000
    },
    "mudança_de_recursos": {
      "Trigo": 0,
      "Peixe": 0,
      "Madeira": 1000,
      "Ferro": 0,
      "Carvão": -1000,
      "Petróleo": -1000
    },
    "moral": 100,
    "moralClasses":  {
        "Baixa" : [100, -5],
        "Media" : [100, -5],
        "Alta" : [100, -5]

    },

    "mudanca_moral": -5,
    "quantidade de fabricas": 0,
    "Torpedeiros": [
      0
    ],
    "Canhoteiros": [
      0
    ],
    "Fragatas": [
      0
    ],
    "Contratorpedeiros": [
      0
    ],
    "Cruzadores": [
      0
    ],
    "Encouraçados": [
      0
    ],
    "base-naval": 0,
    "Construções": {
      "Fazendas": 0,
      "Portos": 0,
      "Marcenarias": 0,
      "Minas de Ferro": 0,
      "Minas de Carvão": 0,
      "Petrolíferas": 0
    }
  },
  "Jogador 3": {
    "pais": "Imperio Japones",
    "nomecliente": "",
    "Turno-local": 0,
    "sistema_de_governo": "Monarquia",
    "recursos": {
        "pratas": 100000,
        "Trigo": 5000,
        "Ferro": 5000,
        "Petróleo": 5000,
        "Carvão": 5000,
        "Peixe": 5000,
        "Madeira": 5000
    },
    "mudança_de_recursos": {
      "Trigo": 1000,
      "Peixe": 2000,
      "Madeira": 1000,
      "Ferro": -2000,
      "Carvão": -2000,
      "Petróleo": -1000
    },
    "moral": 100,
    "moralClasses":  {
        "Baixa" : [100, -5],
        "Media" : [100, -5],
        "Alta" : [100, -5]

    },

    "mudanca_moral": -5,
    "quantidade de fabricas": 0,
    "Torpedeiros": [
      0
    ],
    "Canhoteiros": [
      0
    ],
    "Fragatas": [
      0
    ],
    "Contratorpedeiros": [
      0
    ],
    "Cruzadores": [
      0
    ],
    "Encouraçados": [
      0
    ],
    "base-naval": 0,
    "Construções": {
      "Fazendas": 0,
      "Portos": 0,
      "Marcenarias": 0,
      "Minas de Ferro": 0,
      "Minas de Carvão": 0,
      "Petrolíferas": 0
    }
  },
  "Jogador 4": {
    "pais": "Taiwan",
    "nomecliente": "",
    "Turno-local": 0,
    "sistema_de_governo": "Monarquia",
    "recursos": {
        "pratas": 100000,
        "Trigo": 5000,
        "Ferro": 5000,
        "Petróleo": 5000,
        "Carvão": 5000,
        "Peixe": 5000,
        "Madeira": 5000
    },
    "mudança_de_recursos": {
      "Trigo": 1000,
      "Peixe": 1000,
      "Madeira": 0,
      "Ferro": 1000,
      "Carvão": -2000,
      "Petróleo": -2000
    },
    "moral": 100,
    "moralClasses":  {
        "Baixa" : [100, -5],
        "Media" : [100, -5],
        "Alta" : [100, -5]

    },

    "mudanca_moral": -5,
    "quantidade de fabricas": 0,
    "Torpedeiros": [
      0
    ],
    "Canhoteiros": [
      0
    ],
    "Fragatas": [
      0
    ],
    "Contratorpedeiros": [
      0
    ],
    "Cruzadores": [
      0
    ],
    "Encouraçados": [
      0
    ],
    "base-naval": 0,
    "Construções": {
      "Fazendas": 0,
      "Portos": 0,
      "Marcenarias": 0,
      "Minas de Ferro": 0,
      "Minas de Carvão": 0,
      "Petrolíferas": 0
    }
  },
  "Jogador 5": {
    "pais": "China",
    "nomecliente": "",
    "Turno-local": 0,
    "sistema_de_governo": "Socialismo",
    "recursos": {
        "pratas": 100000,
        "Trigo": 5000,
        "Ferro": 5000,
        "Petróleo": 5000,
        "Carvão": 5000,
        "Peixe": 5000,
        "Madeira": 5000
    },
    "mudança_de_recursos": {
      "Trigo": -2000,
      "Peixe": -2000,
      "Madeira": 1000,
      "Ferro": -1000,
      "Carvão": 2000,
      "Petróleo": 1000
    },
    "moral": 100,
    "moralClasses":  {
        "Baixa" : [100, -5],
        "Media" : [100, -5],
        "Alta" : [100, -5]

    },

    "mudanca_moral": -5,
    "quantidade de fabricas": 0,
    "Torpedeiros": [
      0
    ],
    "Canhoteiros": [
      0
    ],
    "Fragatas": [
      0
    ],
    "Contratorpedeiros": [
      0
    ],
    "Cruzadores": [
      0
    ],
    "Encouraçados": [
      0
    ],
    "base-naval": 0,
    "Construções": {
      "Fazendas": 0,
      "Portos": 0,
      "Marcenarias": 0,
      "Minas de Ferro": 0,
      "Minas de Carvão": 0,
      "Petrolíferas": 0
    }
  }
}
                       """)
#####



if 'jA' in db:
  pass
else:
  db.jA: dict = deepcopy(jogadores) # type: ignore




##### Constantes

app: Flask = Flask(__name__, template_folder="templates")


class Defensor:
  def __init__(self, Ja, jogador, tropa):
    self._data: dict = Ja
    self.jogador = jogador
    self.vida: int | float = self._data[jogador][tropa][1][2][0]
    self.dano: int | float = self._data[jogador][tropa][1][2][1]


class Atacante:
  def __init__(self, Ja, jogador, tropa):
    self._data: dict = Ja
    self.jogador = jogador
    self.vida: int | float = self._data[jogador][tropa][1][2][0]
    self.dano: int | float = self._data[jogador][tropa][1][2][1]

  def attack(self, other: Defensor):
    other.vida = self.dano - other.vida
    self.vida = other.dano/2 - self.vida
def battle(atac: Atacante, defe: Defensor):
  atac.attack(defe)
  return [(atac.jogador, atac.vida), (defe.jogador, defe.vida)]


##### App Routes

@app.route('/')
def init():
    app.add_url_rule('/favicon.ico',
                 redirect_to=url_for('static', filename='favicon.ico'))
    return render_template("index.html")

@app.route('/enter', methods=['POST'])
def enter():
    try:
      data: dict[str: str] = json.loads(request.get_json())
    except json.decoder.JSONDecodeError:
      return 300
    if db.jA.turno != 0:
        if db.jA["Jogador 1"].nomecliente:
            if db.jA["Jogador 2"].nomecliente:
                if db.jA["Jogador 3"].nomecliente:
                    if db.jA["Jogador 4"].nomecliente:
                        if db.jA["Jogador 5"].nomecliente:
                           return "Servidor Lotado"
                        else:
                           db.jA["Jogador 5"].nomecliente = data.username
                    else:
                        db.jA["Jogador 4"].nomecliente = data.username
                else:
                    db.jA["Jogador 3"].nomecliente = data.username
            else:
                db.jA["Jogador 2"].nomecliente = data.username
        else:
            db.jA["Jogador 1"].nomecliente = data.username
    else:
        return "Partida já está em andamento"

    return jsonify(db.jA)


@app.route('/logout', methods=['POST'])
def logout():
    global db
    nome: str = json.loads(request.get_json())["username"]
    db.jA[nome] = jogadores[nome]

    lista: list[str] = ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4', 'Jogador 5']
    lista.remove(nome)

    for jogador in lista:
      if db.jA[jogador].nomecliente:
        pass
      else:
        lista.remove(jogador)

    if lista:
      return jsonify({"Response": 200})
    elif lista == []:
      db.jA = deepcopy(jogadores)
      db.resultado = []
      return jsonify({"Response": [200, "Partida Acabou"]})





@app.route('/finalizar_jogada', methods=['POST'])
def FJ():
    turno: int = json.loads(request.get_json())["TurnoFuturo"]
    nomejogador: str = json.loads(request.get_json())["usertag"]
    newdata: dict = json.loads(request.get_json())["newdata"]

    db.jA[nomejogador] = newdata

    db.jA[nomejogador]["Turno-local"] = turno

    lista: list[str] = ['Jogador 1', 'Jogador 2', 'Jogador 3', 'Jogador 4', 'Jogador 5']
    listativos: list[str] = []
    listaTurnosLocais: list[int] = []

    for jogador in lista:
      if db.jA[jogador].nomecliente:
        listativos.append(jogador)

    for jogador in listativos:
      if db.jA[jogador]['Turno-local'] != db.jA.Turno:
        listaTurnosLocais.append(db.jA[jogador]['Turno-local'])

    if len(listativos) == len(listaTurnosLocais):
      TurnoInicial = listaTurnosLocais[0]
      for turno in listaTurnosLocais:
        if TurnoInicial == turno:
          pass
        else:
          return jsonify({"Status": "WOP"})
    else:
      return jsonify({"Status": "WOP"})


    for jogador in lista:
      db.jA[jogador]["Turno-local"] = TurnoInicial

    db.jA.Turno = TurnoInicial

    return jsonify({"Status": "Success"})


@app.route('/Requisitar_dados', methods=['POST'])
def RD():
    return jsonify(db.jA)


@app.route('/batalha', methods=['POST'])
def batalha():
    global db
    atacanteNome: dict = json.loads(request.get_json())["atacanteNome"]
    atacanteTropa: dict = json.loads(request.get_json())["atacanteTropa"]
    defensorNome: dict = json.loads(request.get_json())["defensorNome"]
    defensorTropa: dict = json.loads(request.get_json())["defensorTropa"]


    JogadorA: Atacante = Atacante(db.jA, atacanteNome, atacanteTropa)

    JogadorD: Defensor = Defensor(db.jA, defensorNome, defensorTropa)

    if not db.hasbattle:

      db.hasbattle = True
      db.resultado = battle(JogadorA, JogadorD)
      return jsonify({"Result": db.resultado})

    else:
      db.morebattles.append(battle(JogadorA, JogadorD))
      return jsonify({"Result+": db.morebattles[-1]})


@app.route('/finalTurno', methods=['POST'])
def finalturno():
    global db
    if db.hasbattle:
      db.hasbattle = False
      if db.morebattles:
        return jsonify({"Battles": [db.resultado ,( elemento for sublista in db.morebattles for elemento in sublista )], "Data": db.jA})
      return jsonify({"Battle": db.resultado, "Data": db.jA})

    else:
      return jsonify({"No-Battle, newdata": db.jA})
