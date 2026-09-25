"""Check if anqiao_crm schema is empty (read-only verification)."""
from crm.persistence.database import SessionLocal
from sqlalchemy import text

def main():
    s = SessionLocal()
    
    # Check if anqiao_crm schema exists and has tables
    result = s.execute(text("""
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'anqiao_crm' 
          AND table_type = 'BASE TABLE'
    """))
    count = result.scalar()
    
    print(f"anqiao_crm schema table count: {count}")
    
    if count == 0:
        print("STATUS: Schema is EMPTY (zero business tables) - OK to proceed with migration")
    else:
        print(f"ERROR: Schema has {count} tables - abort migration, this may be unauthorized data")
        c.close()
        s.close()
        exit(1)
    
    c.close()
    s.close()

if __name__ == "__main__":
    main()
