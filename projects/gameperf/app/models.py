"""Versioned input contracts. Client metadata and approval states are never trusted."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    @field_validator('*', mode='after')
    @classmethod
    def text_limits(cls, value):
        if isinstance(value, str) and len(value) > 12000:
            raise ValueError('文本超过 12000 字符')
        return value

class Project(Contract):
    name: str = Field(min_length=1, max_length=120)
    tagline: str = Field(default='', max_length=300)
    owner: str = Field(default='', max_length=120)
    goal: str = ''

class Node(Contract):
    name: str = Field(min_length=1, max_length=120)
    group: Literal['governance','business','agent','capability','evolution','assurance','shared'] = 'capability'
    subtitle: str = Field(default='', max_length=300)
    inputs: str = ''
    outputs: str = ''
    gate: str = ''
    owner: str = Field(default='待指定', max_length=120)
    status: Literal['planned','existing','integrating','validated'] = 'planned'
    parentId: str = Field(default='', max_length=100)
    notes: str = ''

class Task(Contract):
    title: str = Field(min_length=1, max_length=200)
    status: Literal['planned','diagnosing','optimizing','review','done','blocked'] = 'planned'
    stageId: str = Field(default='diagnose', max_length=100)
    priority: Literal['normal','high','urgent'] = 'normal'
    owner: str = Field(default='', max_length=120)
    device: str = Field(default='', max_length=300)
    game: str = Field(default='', max_length=300)
    baseline: str = Field(default='', max_length=300)
    objective: str = ''
    constraints: str = ''
    budget: str = ''
    stopCondition: str = ''
    allowedActions: str = ''
    evalVersion: str = Field(default='', max_length=300)
    notes: str = ''
    sample: bool = False

class Experiment(Contract):
    title: str = Field(min_length=1, max_length=200)
    taskId: str = Field(min_length=1, max_length=100)
    hypothesis: str = ''
    baseline: str = Field(default='', max_length=300)
    candidate: str = Field(default='', max_length=300)
    device: str = Field(default='', max_length=300)
    game: str = Field(default='', max_length=300)
    scene: str = ''
    environment: str = ''
    repeats: int = Field(default=0, ge=0, le=100000)
    p95Baseline: float | None = Field(default=None, ge=0, le=100000, allow_inf_nan=False)
    p95Candidate: float | None = Field(default=None, ge=0, le=100000, allow_inf_nan=False)
    powerBaseline: float | None = Field(default=None, ge=0, le=10000, allow_inf_nan=False)
    powerCandidate: float | None = Field(default=None, ge=0, le=10000, allow_inf_nan=False)
    tempCandidate: float | None = Field(default=None, ge=-100, le=300, allow_inf_nan=False)
    evidence: str = ''
    notes: str = ''
    status: Literal['draft','review'] = 'draft'
    sample: bool = False

class Evolution(Contract):
    title: str = Field(min_length=1, max_length=200)
    kind: Literal['diagnosis','search','tool','workflow'] = 'workflow'
    oldVersion: str = Field(default='', max_length=300)
    candidateVersion: str = Field(default='', max_length=300)
    modelVersion: str = Field(default='', max_length=300)
    evalVersion: str = Field(default='', max_length=300)
    holdout: str = ''
    budget: str = ''
    result: str = ''
    evidence: str = ''
    notes: str = ''
    status: Literal['draft','review'] = 'draft'
    sample: bool = False

class Feedback(Contract):
    title: str = Field(min_length=1, max_length=200)
    source: str = Field(default='用户反馈', max_length=120)
    device: str = Field(default='', max_length=300)
    game: str = Field(default='', max_length=300)
    baseline: str = Field(default='', max_length=300)
    description: str = ''
    status: Literal['unverified','reproduced','linked','closed'] = 'unverified'
    taskId: str = Field(default='', max_length=100)
    sample: bool = False

CONTRACTS = {'nodes': Node, 'tasks': Task, 'experiments': Experiment, 'evolutions': Evolution, 'feedback': Feedback}
