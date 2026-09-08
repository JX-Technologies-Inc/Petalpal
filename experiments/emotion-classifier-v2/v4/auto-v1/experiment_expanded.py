"""Same trainer with max384 to retain all repaired long journals (longest352 tokens)."""
import experiment
class CompleteJournalData(experiment.Data):
    def __init__(self,rows,tok):
        self.rows=rows
        self.encoded=tok([r['journal'] for r in rows],truncation=True,max_length=384)
experiment.Data=CompleteJournalData
if __name__=='__main__':experiment.main()
