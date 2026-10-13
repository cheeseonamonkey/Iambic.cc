import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pipeline as p

def test_features():
    assert p.features("We have the meats.") is not None
    assert p.features("") is None
    v=p.features("The super sundae is on sale today.")
    assert 0 <= v["alliteration"] <= 1
    assert abs(v["iamb"]+v["trochee"]-1)<1e-12
    assert 0 <= v["coverage"] <= 1

def test_negative_vote_score():
    s=p.source_specs()[0]
    r=p.normalized({"id":"x","body":"I think this might work very well.",
                    "score":"-3","created_utc":"1727800000"},s)
    assert r["engagement"]==-3.0
    assert r["month"]=="2024-10"

def test_quotas():
    old=p.MODE
    try:
        p.MODE="full"
        groups=p.source_specs()
        sums={x:sum(s["quota"] for s in groups if s["platform"]==x)
              for x in ("reddit","x","bluesky")}
        assert sums=={"reddit":3000000,"x":3000000,"bluesky":3000000}
    finally:
        p.MODE=old

def test_rights_gate():
    assert all(not allowed for allowed in p.APPROVED.values())

def test_no_perfect_collinearity():
    assert "iamb" in p.FEATS
    assert "trochee" not in p.FEATS
